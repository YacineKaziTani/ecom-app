import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, createCoupon, placeGuestOrder, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import { Shipment } from "../src/entities/Shipment";
import { rollUpStatus } from "../src/services/fulfilment";

beforeAll(initTestDb);
afterEach(async () => {
  delete process.env.PLATFORM_COMMISSION_PERCENT;
  await clearDatabase();
});
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const shipments = () => AppDataSource.getRepository(Shipment);

async function seller(price = 1000) {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, { price, stock: 20 });
  return { agent, shop, product };
}

async function mixedCodOrder() {
  const a = await seller(1000);
  const b = await seller(500);
  const res = await request(app)
    .post("/api/orders")
    .send({
      ...DELIVERY,
      shippingAddress: "Rue des Frères Bouadou",
      guestEmail: "mixed@example.com",
      paymentMethod: "cod",
      items: [
        { productId: a.product.id, quantity: 1 },
        { productId: b.product.id, quantity: 2 },
      ],
    });
  expect(res.status).toBe(201);
  return { a, b, orderId: res.body.id as string };
}

const ship = (agent: any, orderId: string, shopId: string, body: object) =>
  agent.patch(`/api/orders/${orderId}/shipments/${shopId}`).send(body);

describe("rollUpStatus", () => {
  it("follows the slowest shipment", () => {
    expect(rollUpStatus(["delivered", "shipped"])).toBe("shipped");
    expect(rollUpStatus(["delivered", "delivered"])).toBe("delivered");
    expect(rollUpStatus(["processing", "pending"])).toBe("pending");
  });
});

describe("per-shop shipments", () => {
  it("creates one shipment per shop at checkout", async () => {
    const { a, b, orderId } = await mixedCodOrder();
    const rows = await shipments().find({ where: { orderId } });
    expect(rows.map((s) => s.shopId).sort()).toEqual([a.shop.id, b.shop.id].sort());
    expect(rows.every((s) => s.status === "pending")).toBe(true);
  });

  it("lets each shop progress its own part; the order follows the slowest", async () => {
    const { a, b, orderId } = await mixedCodOrder();

    await ship(a.agent, orderId, a.shop.id, { status: "shipped", carrier: "Yalidine", trackingNumber: "YAL-123" }).expect(200);
    expect((await orders().findOneByOrFail({ id: orderId })).status).toBe("pending"); // B hasn't started

    const res = await ship(b.agent, orderId, b.shop.id, { status: "shipped" }).expect(200);
    expect(res.body.order.status).toBe("shipped");

    await ship(a.agent, orderId, a.shop.id, { status: "delivered" }).expect(200);
    const last = await ship(b.agent, orderId, b.shop.id, { status: "delivered" }).expect(200);
    expect(last.body.order).toMatchObject({ status: "delivered", paymentStatus: "paid" }); // COD collected

    const mine = await a.agent.get(`/api/orders/${orderId}`);
    expect(mine.body.shipments).toHaveLength(1);
    expect(mine.body.shipments[0]).toMatchObject({ trackingNumber: "YAL-123", carrier: "Yalidine" });
  });

  it("stops a shop from touching another shop's shipment", async () => {
    const { a, b, orderId } = await mixedCodOrder();
    expect((await ship(a.agent, orderId, b.shop.id, { status: "shipped" })).status).toBe(403);
  });

  it("waits for payment before a card order can be fulfilled", async () => {
    const s = await seller();
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "card" });
    const res = await ship(s.agent, order.body.id, s.shop.id, { status: "processing" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/paid/);
  });

  it("moves every shipment along when a super admin changes the order", async () => {
    const { orderId } = await mixedCodOrder();
    const { agent: superAdmin } = await loginAs("super_admin");
    await superAdmin.patch(`/api/orders/${orderId}/status`).send({ status: "cancelled" }).expect(200);
    const rows = await shipments().find({ where: { orderId } });
    expect(rows.every((s) => s.status === "cancelled")).toBe(true);
  });

  it("refuses shipment updates on a cancelled order", async () => {
    const s = await seller();
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "cancelled" }).expect(200);
    expect((await ship(s.agent, order.body.id, s.shop.id, { status: "shipped" })).status).toBe(400);
  });
});

describe("payouts", () => {
  async function deliveredCodOrder(quantity: number, couponCode?: string) {
    const s = await seller(1000);
    const order = await placeGuestOrder(s.product.id, quantity, { paymentMethod: "cod", couponCode });
    expect(order.status).toBe(201);
    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "delivered" }).expect(200);
    return s;
  }

  it("earns sales minus commission once the money is in", async () => {
    process.env.PLATFORM_COMMISSION_PERCENT = "10";
    const s = await deliveredCodOrder(2);
    // An unpaid order for the same shop doesn't count yet.
    await placeGuestOrder(s.product.id, 5, { paymentMethod: "cod" });

    const res = await s.agent.get("/api/payouts/mine");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sales: 2000, commission: 200, discounts: 0, earned: 1800, paidOut: 0, balance: 1800 });
  });

  it("charges a shop's own coupon to the shop", async () => {
    const s = await seller(1000);
    await createCoupon({ code: "SHOP100", type: "fixed", value: 100, shopId: s.shop.id });
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod", couponCode: "SHOP100" });
    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "delivered" }).expect(200);

    const res = await s.agent.get("/api/payouts/mine");
    expect(res.body).toMatchObject({ sales: 1000, discounts: 100, earned: 900 });
  });

  it("records payouts, never above what the shop is owed", async () => {
    const s = await deliveredCodOrder(1);
    const { agent: superAdmin } = await loginAs("super_admin");

    const tooMuch = await superAdmin.post("/api/payouts").send({ shopId: s.shop.id, amount: 5000 });
    expect(tooMuch.status).toBe(400);

    const ok = await superAdmin.post("/api/payouts").send({ shopId: s.shop.id, amount: 600, reference: "CCP-0001" });
    expect(ok.status).toBe(201);

    const balances = await superAdmin.get("/api/payouts/balances");
    const row = balances.body.shops.find((x: any) => x.shopId === s.shop.id);
    expect(row).toMatchObject({ earned: 1000, paidOut: 600, balance: 400 });

    const history = await s.agent.get("/api/payouts");
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].reference).toBe("CCP-0001");
  });

  it("is super-admin only to record a payout", async () => {
    const s = await deliveredCodOrder(1);
    expect((await s.agent.post("/api/payouts").send({ shopId: s.shop.id, amount: 10 })).status).toBe(403);
  });
});
