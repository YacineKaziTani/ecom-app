import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, placeGuestOrder, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import { Product } from "../src/entities/Product";
import { sentSms } from "../src/services/sms";

beforeAll(initTestDb);
afterEach(async () => {
  delete process.env.SMS_PROVIDER;
  delete process.env.COD_OTP_MIN_TOTAL;
  sentSms.length = 0;
  await clearDatabase();
});
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const stockOf = async (id: string) => (await AppDataSource.getRepository(Product).findOneByOrFail({ id })).stock;

async function seller(price = 1500, stock = 10) {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, { price, stock });
  return { agent, shop, product };
}

describe("phone confirmation of pay-on-delivery orders", () => {
  it("confirmed → processing, with the time recorded", async () => {
    const s = await seller();
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    const res = await s.agent.post(`/api/orders/${order.body.id}/calls`).send({ outcome: "confirmed", note: "Livraison samedi" });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("processing");
    expect(res.body.order.confirmedAt).toBeTruthy();
  });

  it("no answer → counted, still pending", async () => {
    const s = await seller();
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    await s.agent.post(`/api/orders/${order.body.id}/calls`).send({ outcome: "no_answer" }).expect(201);
    const res = await s.agent.post(`/api/orders/${order.body.id}/calls`).send({ outcome: "no_answer" });
    expect(res.body.order).toMatchObject({ status: "pending", callAttempts: 2 });
  });

  it("declined / wrong number → cancelled and restocked", async () => {
    const s = await seller(1500, 10);
    const order = await placeGuestOrder(s.product.id, 3, { paymentMethod: "cod" });
    expect(await stockOf(s.product.id)).toBe(7);
    const res = await s.agent.post(`/api/orders/${order.body.id}/calls`).send({ outcome: "wrong_number" });
    expect(res.body.order.status).toBe("cancelled");
    expect(await stockOf(s.product.id)).toBe(10);
  });

  it("only applies to COD orders awaiting confirmation, from an admin who can see them", async () => {
    const s = await seller();
    const card = await placeGuestOrder(s.product.id, 1, { paymentMethod: "card" });
    expect((await s.agent.post(`/api/orders/${card.body.id}/calls`).send({ outcome: "confirmed" })).status).toBe(400);

    const cod = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    const other = await seller();
    expect((await other.agent.post(`/api/orders/${cod.body.id}/calls`).send({ outcome: "confirmed" })).status).toBe(403);
  });

  it("keeps call notes away from the customer", async () => {
    const s = await seller();
    const customer = await loginAs("customer");
    const order = await customer.agent.post("/api/orders").send({
      ...DELIVERY, shippingAddress: "Oran", paymentMethod: "cod", items: [{ productId: s.product.id, quantity: 1 }],
    });
    await s.agent.post(`/api/orders/${order.body.id}/calls`).send({ outcome: "no_answer", note: "Messagerie" }).expect(201);

    expect((await s.agent.get(`/api/orders/${order.body.id}`)).body.calls[0]).toMatchObject({ outcome: "no_answer", note: "Messagerie" });
    expect((await customer.agent.get(`/api/orders/${order.body.id}`)).body.calls).toBeUndefined();
  });
});

describe("returned parcels", () => {
  it("restock, record why, and drop out of revenue", async () => {
    const s = await seller(1500, 10);
    const order = await placeGuestOrder(s.product.id, 2, { paymentMethod: "cod" });
    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "shipped" }).expect(200);
    expect(await stockOf(s.product.id)).toBe(8);

    const res = await s.agent
      .patch(`/api/orders/${order.body.id}/status`)
      .send({ status: "returned", returnReason: "Refusé à la porte", returnCost: 400 });
    expect(res.status).toBe(200);
    expect(await stockOf(s.product.id)).toBe(10);
    const saved = await orders().findOneByOrFail({ id: order.body.id });
    expect(saved).toMatchObject({ status: "returned", returnReason: "Refusé à la porte" });
    expect(Number(saved.returnCost)).toBe(400);
    expect(saved.returnedAt).toBeTruthy();
  });

  it("can only follow a shipment", async () => {
    const s = await seller();
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    expect((await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "returned" })).status).toBe(400);
  });

  it("are excluded from revenue and payouts even after delivery", async () => {
    const s = await seller(1000, 10);
    const order = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "delivered" }).expect(200);
    expect((await s.agent.get("/api/payouts/mine")).body.sales).toBe(1000);

    await s.agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "returned" }).expect(200);
    expect((await s.agent.get("/api/payouts/mine")).body.sales).toBe(0);
    expect((await s.agent.get("/api/orders/summary")).body.revenue).toBe(0);
  });
});

describe("customer risk", () => {
  it("flags a phone number with a past return", async () => {
    const s = await seller();
    const first = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    await s.agent.patch(`/api/orders/${first.body.id}/status`).send({ status: "shipped" }).expect(200);
    await s.agent.patch(`/api/orders/${first.body.id}/status`).send({ status: "returned" }).expect(200);
    await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });

    const list = await s.agent.get("/api/orders");
    expect(list.body.items[0].customerRisk).toMatchObject({ orders: 2, returned: 1, level: "medium", blocked: false });
  });
});

describe("blocked numbers", () => {
  it("blocks pay on delivery (not card payment) and can be lifted", async () => {
    const s = await seller();
    const { agent: superAdmin } = await loginAs("super_admin");
    await superAdmin.post("/api/blocked-phones").send({ phone: DELIVERY.phone, reason: "3 refused parcels" }).expect(201);

    const cod = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    expect(cod.status).toBe(400);
    expect(cod.body.code).toBe("COD_BLOCKED");
    expect((await placeGuestOrder(s.product.id, 1, { paymentMethod: "card" })).status).toBe(201);

    const list = await s.agent.get("/api/orders");
    expect(list.body.items[0].customerRisk.level).toBe("blocked");

    await superAdmin.delete("/api/blocked-phones/0550123456").expect(204);
    expect((await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" })).status).toBe(201);
  });

  it("is managed by super admins only", async () => {
    const { agent } = await loginAs("admin");
    expect((await agent.post("/api/blocked-phones").send({ phone: "0661000000" })).status).toBe(403);
  });
});

describe("SMS code for larger pay-on-delivery orders", () => {
  beforeEach(() => {
    process.env.SMS_PROVIDER = "memory";
    process.env.COD_OTP_MIN_TOTAL = "1000";
  });

  it("is advertised in /api/config", async () => {
    expect((await request(app).get("/api/config")).body.codOtpMinTotal).toBe(1000);
  });

  it("is required above the threshold, verified, and single-use", async () => {
    const s = await seller(1500);
    const noCode = await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" });
    expect(noCode.status).toBe(400);
    expect(noCode.body.code).toBe("PHONE_CODE_REQUIRED");

    await request(app).post("/api/phone-verifications").send({ phone: DELIVERY.phone }).expect(200);
    expect(sentSms[0].to).toBe("+213550123456");
    const code = /(\d{6})/.exec(sentSms[0].body)![1];

    const base = { ...DELIVERY, shippingAddress: "Alger", guestEmail: "otp@example.com", paymentMethod: "cod", items: [{ productId: s.product.id, quantity: 1 }] };
    const wrong = await request(app).post("/api/orders").send({ ...base, phoneCode: code === "000000" ? "111111" : "000000" });
    expect(wrong.body.code).toBe("PHONE_CODE_INVALID");

    expect((await request(app).post("/api/orders").send({ ...base, phoneCode: code })).status).toBe(201);
    const reused = await request(app).post("/api/orders").send({ ...base, phoneCode: code });
    expect(reused.body.code).toBe("PHONE_CODE_INVALID");
  });

  it("isn't needed below the threshold", async () => {
    const s = await seller(500);
    expect((await placeGuestOrder(s.product.id, 1, { paymentMethod: "cod" })).status).toBe(201);
  });

  it("limits how many codes a number can receive", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/phone-verifications").send({ phone: "0770112233" }).expect(200);
    }
    expect((await request(app).post("/api/phone-verifications").send({ phone: "0770112233" })).status).toBe(429);
  });
});
