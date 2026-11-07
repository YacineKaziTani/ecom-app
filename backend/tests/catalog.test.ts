import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Product } from "../src/entities/Product";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

const products = () => AppDataSource.getRepository(Product);

async function seller() {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  const product = await createProduct(shop.id, { price: 1200, stock: 20 });
  return { agent, shop, product };
}

// A customer whose pay-on-delivery order for `productId` was delivered.
async function buyer(sellerAgent: any, productId: string, overrides = {}) {
  const customer = await loginAs("customer", { firstName: "Amina", lastName: "Benali", ...overrides });
  const order = await customer.agent.post("/api/orders").send({
    ...DELIVERY,
    shippingAddress: "Cité 1200 logements",
    paymentMethod: "cod",
    items: [{ productId, quantity: 1 }],
  });
  expect(order.status).toBe(201);
  await sellerAgent.patch(`/api/orders/${order.body.id}/status`).send({ status: "delivered" }).expect(200);
  return customer;
}

describe("reviews", () => {
  it("lets a verified buyer review, and keeps the product's rating in sync", async () => {
    const s = await seller();
    const amina = await buyer(s.agent, s.product.id);
    const karim = await buyer(s.agent, s.product.id, { firstName: "Karim", lastName: "Haddad" });

    await amina.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 5, comment: "Superbe !" }).expect(201);
    await karim.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 4 }).expect(201);

    let p = await products().findOneByOrFail({ id: s.product.id });
    expect([Number(p.ratingAverage), p.ratingCount]).toEqual([4.5, 2]);

    // Posting again updates the same review instead of adding one.
    await karim.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 2 }).expect(201);
    p = await products().findOneByOrFail({ id: s.product.id });
    expect([Number(p.ratingAverage), p.ratingCount]).toEqual([3.5, 2]);

    const list = await amina.agent.get(`/api/products/${s.product.id}/reviews`);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((r: any) => r.author).sort()).toEqual(["Amina B.", "Karim H."]);
    expect(list.body.canReview).toBe(true);
    expect(list.body.mine).toMatchObject({ rating: 5, comment: "Superbe !" });
    expect(JSON.stringify(list.body)).not.toContain("@example.com"); // no emails leak
  });

  it("refuses people who haven't bought the product, or haven't confirmed their email", async () => {
    const s = await seller();
    const { agent: stranger } = await loginAs("customer");
    expect((await stranger.post(`/api/products/${s.product.id}/reviews`).send({ rating: 5 })).status).toBe(403);
    expect((await stranger.get(`/api/products/${s.product.id}/reviews`)).body.canReview).toBe(false);

    const unverified = await buyer(s.agent, s.product.id, { emailVerifiedAt: null });
    const res = await unverified.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 5 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/email/);
  });

  it("doesn't count an order that hasn't been paid for", async () => {
    const s = await seller();
    const customer = await loginAs("customer");
    await customer.agent.post("/api/orders").send({
      ...DELIVERY, shippingAddress: "Alger", paymentMethod: "cod", items: [{ productId: s.product.id, quantity: 1 }],
    }).expect(201);
    expect((await customer.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 5 })).status).toBe(403);
  });

  it("lets the author or a super admin delete a review", async () => {
    const s = await seller();
    const amina = await buyer(s.agent, s.product.id);
    const created = await amina.agent.post(`/api/products/${s.product.id}/reviews`).send({ rating: 1 });

    const { agent: other } = await loginAs("customer");
    expect((await other.delete(`/api/reviews/${created.body.id}`)).status).toBe(403);

    const { agent: superAdmin } = await loginAs("super_admin");
    expect((await superAdmin.delete(`/api/reviews/${created.body.id}`)).status).toBe(204);
    const p = await products().findOneByOrFail({ id: s.product.id });
    expect([Number(p.ratingAverage), p.ratingCount]).toEqual([0, 0]);
  });
});

describe("wishlist", () => {
  it("saves products once and lists them with their details", async () => {
    const s = await seller();
    const { agent } = await loginAs("customer");
    await agent.post("/api/wishlist").send({ productId: s.product.id }).expect(201);
    await agent.post("/api/wishlist").send({ productId: s.product.id }).expect(201); // idempotent

    const list = await agent.get("/api/wishlist");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].product).toMatchObject({ id: s.product.id, shop: { id: s.shop.id } });

    await agent.delete(`/api/wishlist/${s.product.id}`).expect(204);
    expect((await agent.get("/api/wishlist")).body).toHaveLength(0);
  });

  it("needs an account", async () => {
    expect((await request(app).get("/api/wishlist")).status).toBe(401);
  });
});

describe("product gallery", () => {
  it("stores extra photos and validates their URLs", async () => {
    const { agent, user } = await loginAs("admin");
    await createShop(user.id);
    const base = { name: "Tapis kabyle", price: 15000, stock: 3 };

    const bad = await agent.post("/api/products").send({ ...base, galleryUrls: ["javascript:alert(1)"] });
    expect(bad.status).toBe(400);

    const ok = await agent.post("/api/products").send({
      ...base,
      galleryUrls: ["https://res.cloudinary.com/demo/image/upload/a.jpg", "https://res.cloudinary.com/demo/image/upload/b.jpg"],
    });
    expect(ok.status).toBe(201);
    const fetched = await request(app).get(`/api/products/${ok.body.id}`);
    expect(fetched.body.galleryUrls).toHaveLength(2);
    expect(fetched.body).toMatchObject({ ratingCount: 0 });
  });
});
