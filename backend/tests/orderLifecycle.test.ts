import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import {
  loginAs,
  createShop,
  createProduct,
  createCoupon,
  placeGuestOrder,
} from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Coupon } from "../src/entities/Coupon";
import { Order } from "../src/entities/Order";
import { Product } from "../src/entities/Product";
import {
  expireUnpaidOrders,
  RESERVATION_MINUTES,
} from "../src/services/orderLifecycle";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

const orders = () => AppDataSource.getRepository(Order);
const stockOf = async (id: string) =>
  (await AppDataSource.getRepository(Product).findOneByOrFail({ id })).stock;
const usesOf = async (code: string) =>
  (await AppDataSource.getRepository(Coupon).findOneByOrFail({ code })).usedCount;

async function shopAdminWithProduct(overrides: Partial<Product> = {}) {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, overrides);
  return { agent, shop, product };
}

describe("stock reservation for unpaid orders", () => {
  it("gives a new order a reservation deadline", async () => {
    const { product } = await shopAdminWithProduct();
    const before = Date.now();
    const res = await placeGuestOrder(product.id, 1);

    const deadline = new Date(res.body.reservedUntil).getTime();
    expect(deadline).toBeGreaterThanOrEqual(before + RESERVATION_MINUTES * 60_000 - 1000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + RESERVATION_MINUTES * 60_000 + 1000);
  });

  it("cancels an unpaid order once its reservation runs out, restoring stock and the coupon use", async () => {
    const { product } = await shopAdminWithProduct({ price: 100, stock: 5 });
    await createCoupon({ code: "TENOFF", type: "percentage", value: 10, maxUses: 1 });

    const res = await placeGuestOrder(product.id, 3, { couponCode: "TENOFF" });
    expect(res.status).toBe(201);
    expect(await stockOf(product.id)).toBe(2);
    expect(await usesOf("TENOFF")).toBe(1);

    // Not due yet → untouched.
    expect(await expireUnpaidOrders()).toBe(0);

    await orders().update(res.body.id, { reservedUntil: new Date(Date.now() - 1000) });
    expect(await expireUnpaidOrders()).toBe(1);

    const order = await orders().findOneByOrFail({ id: res.body.id });
    expect(order.status).toBe("cancelled");
    expect(order.reservedUntil).toBeNull();
    expect(await stockOf(product.id)).toBe(5);
    expect(await usesOf("TENOFF")).toBe(0); // the single-use coupon is usable again

    // Running again is a no-op — nothing is restocked twice.
    expect(await expireUnpaidOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(5);
  });

  it("never expires a paid order", async () => {
    const { product } = await shopAdminWithProduct({ stock: 5 });
    const res = await placeGuestOrder(product.id, 2);
    await orders().update(res.body.id, {
      paymentStatus: "paid",
      reservedUntil: new Date(Date.now() - 1000),
    });

    expect(await expireUnpaidOrders()).toBe(0);
    expect((await orders().findOneByOrFail({ id: res.body.id })).status).toBe("pending");
    expect(await stockOf(product.id)).toBe(3);
  });
});

describe("coupon usage follows cancel / reactivate", () => {
  it("releases the use on cancel and consumes it again on reactivation", async () => {
    const { agent, product } = await shopAdminWithProduct({ price: 50, stock: 10 });
    await createCoupon({ code: "FIVE", type: "fixed", value: 5 });

    const res = await placeGuestOrder(product.id, 1, { couponCode: "FIVE" });
    expect(await usesOf("FIVE")).toBe(1);

    await agent.patch(`/api/orders/${res.body.id}/status`).send({ status: "cancelled" }).expect(200);
    expect(await usesOf("FIVE")).toBe(0);

    await agent.patch(`/api/orders/${res.body.id}/status`).send({ status: "processing" }).expect(200);
    expect(await usesOf("FIVE")).toBe(1);
  });
});

describe("checkout edge cases", () => {
  it("treats the same product listed twice as one line when checking stock", async () => {
    const { product } = await shopAdminWithProduct({ stock: 5 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "1 Rue Didouche Mourad, Alger",
        guestEmail: "dupe@example.com",
        items: [
          { productId: product.id, quantity: 3 },
          { productId: product.id, quantity: 3 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.issues[0].requestedQuantity).toBe(6);
    expect(await stockOf(product.id)).toBe(5);
  });
});

describe("GET /api/orders pagination and filters", () => {
  it("pages results and filters by status", async () => {
    const { agent, product } = await shopAdminWithProduct({ stock: 50 });
    for (let i = 0; i < 3; i++) await placeGuestOrder(product.id, 1);
    const extra = await placeGuestOrder(product.id, 1);
    await agent.patch(`/api/orders/${extra.body.id}/status`).send({ status: "shipped" }).expect(200);

    const page1 = await agent.get("/api/orders?limit=2&page=1");
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBe(4);
    expect(page1.body.totalPages).toBe(2);

    const page2 = await agent.get("/api/orders?limit=2&page=2");
    expect(page2.body.items).toHaveLength(2);

    const shipped = await agent.get("/api/orders?status=shipped");
    expect(shipped.body.total).toBe(1);
    expect(shipped.body.items[0].id).toBe(extra.body.id);

    expect((await agent.get("/api/orders?status=bogus")).status).toBe(400);
  });
});

describe("GET /api/orders/summary", () => {
  it("counts every order but only paid, non-cancelled revenue", async () => {
    const { product } = await shopAdminWithProduct({ price: 100, stock: 50 });
    const paid = await placeGuestOrder(product.id, 2); // 200, paid
    await placeGuestOrder(product.id, 1); // 100, unpaid → no revenue
    const paidCancelled = await placeGuestOrder(product.id, 1); // paid then cancelled → no revenue
    await orders().update(paid.body.id, { paymentStatus: "paid", status: "processing" });
    await orders().update(paidCancelled.body.id, { paymentStatus: "paid", status: "cancelled" });

    const { agent: superAdmin } = await loginAs("super_admin");
    const res = await superAdmin.get("/api/orders/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalOrders: 3, pendingOrders: 1, revenue: 200 });
  });

  it("scopes a shop admin to their own lines", async () => {
    const mine = await shopAdminWithProduct({ price: 30, stock: 10 });
    const theirs = await shopAdminWithProduct({ price: 70, stock: 10 });
    const mixed = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "Oran",
        guestEmail: "mixed@example.com",
        items: [
          { productId: mine.product.id, quantity: 1 },
          { productId: theirs.product.id, quantity: 1 },
        ],
      });
    await orders().update(mixed.body.id, { paymentStatus: "paid" });

    const res = await mine.agent.get("/api/orders/summary");
    expect(res.body).toEqual({ totalOrders: 1, pendingOrders: 1, revenue: 30 });
  });

  it("is admin-only", async () => {
    const { agent } = await loginAs("customer");
    expect((await agent.get("/api/orders/summary")).status).toBe(403);
  });
});
