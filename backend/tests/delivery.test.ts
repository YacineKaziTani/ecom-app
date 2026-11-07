import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import {
  loginAs,
  createShop,
  createProduct,
  createCoupon,
  placeGuestOrder,
  DELIVERY,
} from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Order } from "../src/entities/Order";
import { ShippingZone } from "../src/entities/ShippingZone";
import { expireUnpaidOrders } from "../src/services/orderLifecycle";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const zones = () => AppDataSource.getRepository(ShippingZone);

async function shopAdminWithProduct(price = 100, stock = 10) {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, { price, stock });
  return { agent, product };
}

describe("shipping zones", () => {
  it("lists all 58 wilayas publicly", async () => {
    const res = await request(app).get("/api/shipping/zones");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(58);
    expect(res.body[15]).toMatchObject({ code: 16, name: "Alger", nameAr: "الجزائر", homePrice: 0, deskPrice: null, isActive: true });
  });

  it("lets only a super admin change prices", async () => {
    const { agent: admin } = await loginAs("admin");
    expect((await admin.patch("/api/shipping/zones/16").send({ homePrice: 400 })).status).toBe(403);

    const { agent: superAdmin } = await loginAs("super_admin");
    const one = await superAdmin.patch("/api/shipping/zones/16").send({ homePrice: 400, deskPrice: 250 });
    expect(one.status).toBe(200);

    const all = await superAdmin.patch("/api/shipping/zones").send({ homePrice: 600 });
    expect(all.status).toBe(200);
    const oran = await zones().findOneByOrFail({ code: 31 });
    expect(Number(oran.homePrice)).toBe(600);
  });
});

describe("checkout with delivery details", () => {
  it("adds the wilaya's home-delivery fee to the total", async () => {
    const { product } = await shopAdminWithProduct(1000);
    await zones().update(16, { homePrice: 400 });

    const res = await placeGuestOrder(product.id, 2);
    expect(res.status).toBe(201);
    expect(Number(res.body.subtotal)).toBe(2000);
    expect(Number(res.body.shippingFee)).toBe(400);
    expect(Number(res.body.total)).toBe(2400);
    expect(res.body).toMatchObject({ wilayaCode: 16, wilayaName: "Alger", phone: "0550123456", deliveryType: "home" });
  });

  it("charges the stop-desk price, and refuses stop-desk where it isn't offered", async () => {
    const { product } = await shopAdminWithProduct();
    const unavailable = await placeGuestOrder(product.id, 1, { deliveryType: "desk" });
    expect(unavailable.status).toBe(400);
    expect(unavailable.body.message).toMatch(/Stop-desk/);

    await zones().update(16, { homePrice: 500, deskPrice: 300 });
    const desk = await placeGuestOrder(product.id, 1, { deliveryType: "desk" });
    expect(desk.status).toBe(201);
    expect(Number(desk.body.shippingFee)).toBe(300);
  });

  it("refuses inactive wilayas", async () => {
    const { product } = await shopAdminWithProduct();
    await zones().update(37, { isActive: false });
    const res = await placeGuestOrder(product.id, 1, { wilayaCode: 37 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/don't deliver/);
  });

  it("validates and normalises the phone number", async () => {
    const { product } = await shopAdminWithProduct();
    const base = { guestEmail: "p@example.com", shippingAddress: "Rue 1", items: [{ productId: product.id, quantity: 1 }] };

    const bad = await request(app).post("/api/orders").send({ ...base, ...DELIVERY, phone: "12345" });
    expect(bad.status).toBe(400);

    const intl = await request(app).post("/api/orders").send({ ...base, ...DELIVERY, phone: "+213 661-23.45.67" });
    expect(intl.status).toBe(201);
    expect(intl.body.phone).toBe("0661234567");
  });

  it("discounts the items only, never the delivery fee", async () => {
    const { product } = await shopAdminWithProduct(100);
    await zones().update(16, { homePrice: 400 });
    await createCoupon({ code: "TEN", type: "percentage", value: 10 });

    const res = await placeGuestOrder(product.id, 1, { couponCode: "TEN" });
    expect(Number(res.body.discountAmount)).toBe(10);
    expect(Number(res.body.total)).toBe(490);
  });
});

describe("pay on delivery", () => {
  it("is offered by /api/config next to card payment", async () => {
    const res = await request(app).get("/api/config");
    expect(res.body.paymentMethods).toEqual(expect.arrayContaining(["cod", "card"]));
  });

  it("holds stock without a deadline, so it's never auto-expired", async () => {
    const { product } = await shopAdminWithProduct();
    const res = await placeGuestOrder(product.id, 1, { paymentMethod: "cod" });
    expect(res.status).toBe(201);
    expect(res.body.paymentMethod).toBe("cod");
    expect(res.body.reservedUntil).toBeNull();

    // Even with a deadline in the past, the expiry job only touches card orders.
    await orders().update(res.body.id, { reservedUntil: new Date(Date.now() - 1000) });
    expect(await expireUnpaidOrders()).toBe(0);
  });

  it("can't be paid online", async () => {
    const { product } = await shopAdminWithProduct();
    const order = await placeGuestOrder(product.id, 1, { paymentMethod: "cod", guestEmail: "cod@example.com" });
    const res = await request(app)
      .post("/api/payments/create-checkout")
      .send({ orderId: order.body.id, email: "cod@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cash on delivery/);
  });

  it("becomes paid when the order is delivered", async () => {
    const { agent, product } = await shopAdminWithProduct();
    const order = await placeGuestOrder(product.id, 1, { paymentMethod: "cod" });

    await agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "shipped" }).expect(200);
    expect((await orders().findOneByOrFail({ id: order.body.id })).paymentStatus).toBe("unpaid");

    const delivered = await agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "delivered" });
    expect(delivered.body.paymentStatus).toBe("paid");
  });

  it("stays unpaid when cancelled", async () => {
    const { agent, product } = await shopAdminWithProduct();
    const order = await placeGuestOrder(product.id, 1, { paymentMethod: "cod" });
    const res = await agent.patch(`/api/orders/${order.body.id}/status`).send({ status: "cancelled" });
    expect(res.body).toMatchObject({ status: "cancelled", paymentStatus: "unpaid" });
  });
});

describe("saved delivery location on the profile", () => {
  it("stores wilaya and commune", async () => {
    const { agent } = await loginAs("customer");
    const res = await agent.patch("/api/auth/me").send({ wilayaCode: 31, commune: "Bir El Djir", phone: "0770 11 22 33" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ wilayaCode: 31, commune: "Bir El Djir" });
  });
});
