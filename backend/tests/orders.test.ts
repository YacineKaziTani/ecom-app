import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, createCoupon } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Product } from "../src/entities/Product";

beforeAll(async () => {
  await initTestDb();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

async function setupShopWithProduct(overrides: Partial<Product> = {}) {
  const { user: owner } = await loginAs("admin");
  const shop = await createShop(owner.id);
  const product = await createProduct(shop.id, overrides);
  return { shop, product };
}

describe("POST /api/orders — checkout", () => {
  it("lets a guest check out without an account", async () => {
    const { product } = await setupShopWithProduct({ price: 20, stock: 5 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "guest@example.com",
        guestName: "Guest Person",
        items: [{ productId: product.id, quantity: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.guestEmail).toBe("guest@example.com");
    expect(Number(res.body.total)).toBe(40);
    expect(res.body.paymentStatus).toBe("unpaid");
  });

  it("rejects guest checkout without an email", async () => {
    const { product } = await setupShopWithProduct();

    const res = await request(app)
      .post("/api/orders")
      .send({ shippingAddress: "123 Main St", items: [{ productId: product.id, quantity: 1 }] });

    expect(res.status).toBe(400);
  });

  it("decrements stock on a successful order", async () => {
    const { product } = await setupShopWithProduct({ stock: 10 });

    await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "stock@example.com",
        items: [{ productId: product.id, quantity: 3 }],
      })
      .expect(201);

    const updated = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(updated!.stock).toBe(7);
  });

  it("returns 409 with issue details when stock is insufficient, without decrementing anything", async () => {
    const { product: inStock } = await setupShopWithProduct({ name: "Available", stock: 10 });
    const { product: outOfStock } = await setupShopWithProduct({ name: "Scarce", stock: 1 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "stockfail@example.com",
        items: [
          { productId: inStock.id, quantity: 2 },
          { productId: outOfStock.id, quantity: 5 }, // more than available
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].availableStock).toBe(1);

    // Crucially: the in-stock item's stock must NOT have been decremented —
    // the whole order failed atomically, nothing partially applied.
    const stillInStock = await AppDataSource.getRepository(Product).findOne({ where: { id: inStock.id } });
    expect(stillInStock!.stock).toBe(10);
  });

  it("returns the SAME order on a retried request with the same Idempotency-Key", async () => {
    const { product } = await setupShopWithProduct({ stock: 10 });
    const idempotencyKey = "test-idempotency-key-123";

    const payload = {
      shippingAddress: "123 Main St",
      guestEmail: "idempotent@example.com",
      items: [{ productId: product.id, quantity: 2 }],
    };

    const first = await request(app).post("/api/orders").set("Idempotency-Key", idempotencyKey).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/orders").set("Idempotency-Key", idempotencyKey).send(payload);
    expect(second.status).toBe(200); // not 201 — nothing new was created
    expect(second.body.id).toBe(first.body.id);

    // Stock should only have been decremented once, not twice.
    const updated = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(updated!.stock).toBe(8);
  });

  it("applies a percentage coupon and records the discount", async () => {
    const { product } = await setupShopWithProduct({ price: 100, stock: 5 });
    await createCoupon({ code: "SAVE10", type: "percentage", value: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "coupon@example.com",
        couponCode: "save10", // lowercase on purpose — codes are matched case-insensitively
        items: [{ productId: product.id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.subtotal)).toBe(100);
    expect(Number(res.body.discountAmount)).toBe(10);
    expect(Number(res.body.total)).toBe(90);
    expect(res.body.couponCode).toBe("SAVE10");
  });

  it("rejects a coupon that's already used up its max uses", async () => {
    const { product } = await setupShopWithProduct({ price: 50, stock: 5 });
    await createCoupon({ code: "ONEUSE", type: "fixed", value: 5, maxUses: 1, usedCount: 1 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "usedup@example.com",
        couponCode: "ONEUSE",
        items: [{ productId: product.id, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/usage limit/i);
  });

  it("rejects a shop-scoped coupon when the cart includes another shop's item", async () => {
    const { shop: shopA, product: productA } = await setupShopWithProduct({ price: 30 });
    const { product: productB } = await setupShopWithProduct({ price: 30 });

    await createCoupon({ code: "SHOPONLY", type: "percentage", value: 20, shopId: shopA.id });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "mixedshop@example.com",
        couponCode: "SHOPONLY",
        items: [
          { productId: productA.id, quantity: 1 },
          { productId: productB.id, quantity: 1 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only applies to orders/i);
  });

  it("caps a fixed-amount coupon's discount at the subtotal (never a negative total)", async () => {
    const { product } = await setupShopWithProduct({ price: 5, stock: 5 });
    await createCoupon({ code: "BIGDISCOUNT", type: "fixed", value: 1000 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "capped@example.com",
        couponCode: "BIGDISCOUNT",
        items: [{ productId: product.id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(0);
    expect(Number(res.body.discountAmount)).toBe(5);
  });
});

describe("order visibility scoping", () => {
  it("only shows a customer their own orders", async () => {
    const { product } = await setupShopWithProduct({ stock: 10 });
    const { agent: customerA } = await loginAs("customer");
    const { agent: customerB } = await loginAs("customer");

    await customerA.post("/api/orders").send({
      shippingAddress: "A's address",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const resB = await customerB.get("/api/orders");
    expect(resB.status).toBe(200);
    expect(resB.body.items).toHaveLength(0);

    const resA = await customerA.get("/api/orders");
    expect(resA.body.items).toHaveLength(1);
  });

  it("scopes an admin's order view to only their shop's line items", async () => {
    const { agent: adminAgent, user: adminUser } = await loginAs("admin");
    const shop = await createShop(adminUser.id);
    const product = await createProduct(shop.id, { stock: 10 });

    const { product: otherProduct } = await setupShopWithProduct({ stock: 10 });

    await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "Somewhere",
        guestEmail: "scoped@example.com",
        items: [{ productId: otherProduct.id, quantity: 1 }],
      });

    const res = await adminAgent.get("/api/orders");
    expect(res.status).toBe(200);
    // The admin's shop had no orders — the other shop's order shouldn't appear.
    expect(res.body.items).toHaveLength(0);
  });
});

describe("PATCH /api/orders/:id/status — stock reconciliation on cancellation", () => {
  it("restores stock when an order is cancelled", async () => {
    const { agent: adminAgent, user: adminUser } = await loginAs("admin");
    const shop = await createShop(adminUser.id);
    const product = await createProduct(shop.id, { stock: 10 });

    const orderRes = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "cancel@example.com",
        items: [{ productId: product.id, quantity: 4 }],
      });
    expect(orderRes.status).toBe(201);

    const afterOrder = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(afterOrder!.stock).toBe(6); // 10 - 4

    const cancelRes = await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "cancelled" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("cancelled");

    const afterCancel = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(afterCancel!.stock).toBe(10); // fully restored
  });

  it("does not double-restore stock if cancelled status is set again (no-op)", async () => {
    const { agent: adminAgent, user: adminUser } = await loginAs("admin");
    const shop = await createShop(adminUser.id);
    const product = await createProduct(shop.id, { stock: 10 });

    const orderRes = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "nodouble@example.com",
        items: [{ productId: product.id, quantity: 3 }],
      });

    await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "cancelled" }).expect(200);
    // Setting the SAME status again should be a no-op, not restock a second time.
    await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "cancelled" }).expect(200);

    const product2 = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(product2!.stock).toBe(10); // not 13
  });

  it("re-deducts stock when reactivating a cancelled order, if enough is available", async () => {
    const { agent: adminAgent, user: adminUser } = await loginAs("admin");
    const shop = await createShop(adminUser.id);
    const product = await createProduct(shop.id, { stock: 10 });

    const orderRes = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "reactivate@example.com",
        items: [{ productId: product.id, quantity: 5 }],
      });

    await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "cancelled" }).expect(200);

    const midway = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(midway!.stock).toBe(10); // restored after cancel

    const reactivateRes = await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "processing" });
    expect(reactivateRes.status).toBe(200);

    const after = await AppDataSource.getRepository(Product).findOne({ where: { id: product.id } });
    expect(after!.stock).toBe(5); // re-deducted
  });

  it("blocks reactivating a cancelled order if stock was consumed elsewhere in the meantime", async () => {
    const { agent: adminAgent, user: adminUser } = await loginAs("admin");
    const shop = await createShop(adminUser.id);
    const product = await createProduct(shop.id, { stock: 5 });

    const orderRes = await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "123 Main St",
        guestEmail: "blocked@example.com",
        items: [{ productId: product.id, quantity: 5 }],
      });

    await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "cancelled" }).expect(200);

    // Someone else buys up all the now-restored stock before the order is reactivated.
    await request(app)
      .post("/api/orders")
      .send({
        shippingAddress: "Elsewhere",
        guestEmail: "competitor@example.com",
        items: [{ productId: product.id, quantity: 5 }],
      })
      .expect(201);

    const reactivateRes = await adminAgent.patch(`/api/orders/${orderRes.body.id}/status`).send({ status: "processing" });
    expect(reactivateRes.status).toBe(409);
    expect(reactivateRes.body.issues).toHaveLength(1);

    // The order must remain cancelled — the failed reactivation shouldn't have partially applied.
    const orderCheck = await adminAgent.get(`/api/orders/${orderRes.body.id}`);
    expect(orderCheck.body.status).toBe("cancelled");
  });
});
