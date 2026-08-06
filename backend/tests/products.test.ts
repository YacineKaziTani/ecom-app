import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop } from "./helpers";

beforeAll(async () => {
  await initTestDb();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("product creation and shop scoping", () => {
  it("blocks a customer from creating a product", async () => {
    const { agent } = await loginAs("customer");
    const res = await agent.post("/api/products").send({ name: "Jam", price: 10, stock: 5 });
    expect(res.status).toBe(403);
  });

  it("lets an admin create a product under their own shop automatically", async () => {
    const { agent, user } = await loginAs("admin");
    await createShop(user.id, { name: "Admin's Shop" });

    const res = await agent.post("/api/products").send({ name: "Strawberry Jam", price: 12.5, stock: 20 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Strawberry Jam");
    expect(res.body.shopId).toBeTruthy();
  });

  it("blocks an admin from editing another shop's product", async () => {
    const { agent: ownerAgent, user: owner } = await loginAs("admin");
    await createShop(owner.id, { name: "Owner Shop" });
    const createRes = await ownerAgent.post("/api/products").send({ name: "Owner's Product", price: 5, stock: 10 });
    const productId = createRes.body.id;

    const { agent: intruderAgent, user: intruder } = await loginAs("admin");
    await createShop(intruder.id, { name: "Intruder Shop" });

    const editRes = await intruderAgent.put(`/api/products/${productId}`).send({ name: "Hijacked!" });
    expect(editRes.status).toBe(403);
  });

  it("lets a super_admin create a product for any shop by passing shopId", async () => {
    const { user: owner } = await loginAs("admin");
    const shop = await createShop(owner.id);

    const { agent: superAgent } = await loginAs("super_admin");
    const res = await superAgent.post("/api/products").send({ name: "Platform Product", price: 8, stock: 15, shopId: shop.id });

    expect(res.status).toBe(201);
    expect(res.body.shopId).toBe(shop.id);
  });

  it("rejects an invalid image URL", async () => {
    const { agent, user } = await loginAs("admin");
    await createShop(user.id);

    const res = await agent.post("/api/products").send({ name: "Bad Image", price: 5, stock: 1, imageUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("searches across name and description", async () => {
    const { agent, user } = await loginAs("admin");
    await createShop(user.id);
    await agent.post("/api/products").send({ name: "Mystery Box", description: "a lavender-scented candle inside", price: 9, stock: 5 });
    await agent.post("/api/products").send({ name: "Plain Jam", description: "just jam", price: 5, stock: 5 });

    const res = await request(app).get("/api/products").query({ search: "lavender" });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("Mystery Box");
  });

  it("returns a clean 400 for a malformed product id instead of a 500", async () => {
    const res = await request(app).get("/api/products/not-a-uuid");
    expect(res.status).toBe(400);
  });
});
