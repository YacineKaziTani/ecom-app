import request from "supertest";
import { IsNull, Not } from "typeorm";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createCoupon, createProduct, createShop, loginAs, placeGuestOrder } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { ShippingZone } from "../src/entities/ShippingZone";
import { StockAlert } from "../src/entities/StockAlert";
import { ProductVariant } from "../src/entities/ProductVariant";
import { Product } from "../src/entities/Product";
import * as mailer from "../src/services/email";
import { sendBackInStockAlerts } from "../src/services/stockAlerts";
import { settleBackgroundTasks } from "../src/utils/background";

beforeAll(initTestDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(closeTestDb);

async function shopAdmin() {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  return { agent, shop };
}

describe("promotions", () => {
  it("keeps a crossed-out price only while it's above the selling price", async () => {
    const { agent } = await shopAdmin();
    const created = await agent.post("/api/products").send({ name: "Bol", price: 2000, compareAtPrice: 2500, stock: 3 });
    expect(created.status).toBe(201);
    expect(Number(created.body.compareAtPrice)).toBe(2500);

    const low = await agent.post("/api/products").send({ name: "Vase", price: 2000, compareAtPrice: 2000, stock: 3 });
    expect(low.status).toBe(400);
    expect(low.body.code).toBe("COMPARE_AT_TOO_LOW");
    // Raising the price above it is refused too…
    expect((await agent.put(`/api/products/${created.body.id}`).send({ price: 3000 })).body.code).toBe("COMPARE_AT_TOO_LOW");
    // …until the promotion ends.
    const ended = await agent.put(`/api/products/${created.body.id}`).send({ price: 3000, compareAtPrice: null });
    expect(ended.status).toBe(200);
    expect(ended.body.compareAtPrice).toBeNull();
  });

  it("lists the products on sale, biggest discount first on the home page", async () => {
    const { shop } = await shopAdmin();
    await createProduct(shop.id, { name: "Normal", price: 1000 });
    await createProduct(shop.id, { name: "Moins 10", price: 900, compareAtPrice: 1000 });
    await createProduct(shop.id, { name: "Moins 50", price: 500, compareAtPrice: 1000 });
    await createProduct(shop.id, { name: "Épuisé", price: 500, compareAtPrice: 1000, stock: 0 });

    const list = await request(app).get("/api/products").query({ onSale: "true", sort: "name_asc" });
    expect(list.body.items.map((p: { name: string }) => p.name)).toEqual(["Moins 10", "Moins 50", "Épuisé"]);
    const home = await request(app).get("/api/home");
    expect(home.body.onSale.map((p: { name: string }) => p.name)).toEqual(["Moins 50", "Moins 10"]);
  });

  it("imports a crossed-out price column from a spreadsheet", async () => {
    const { agent } = await shopAdmin();
    const res = await agent.post("/api/products/import").send({ csv: "Nom;Prix;Prix barré;Stock\nTapis;8000;9500;2\n" });
    expect(res.status).toBe(201);
    const product = await AppDataSource.getRepository(Product).findOneByOrFail({ name: "Tapis" });
    expect(Number(product.compareAtPrice)).toBe(9500);
    const bad = await agent.post("/api/products/import").send({ csv: "name,price,oldprice\nVase,5000,4000\n" });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].message).toMatch(/crossed-out/);
  });

  it("makes delivery free from the store's threshold, counted after the coupon", async () => {
    await AppDataSource.getRepository(ShippingZone).update({ code: 16 }, { homePrice: 400 });
    const { shop } = await shopAdmin();
    const cheap = await createProduct(shop.id, { price: 3000, stock: 10 });
    const dear = await createProduct(shop.id, { price: 6000, stock: 10 });
    const { agent: superAdmin } = await loginAs("super_admin");
    expect((await superAdmin.put("/api/settings").send({ freeShippingThreshold: 5000 })).body.freeShippingThreshold).toBe(5000);

    const below = await placeGuestOrder(cheap.id, 1);
    expect([Number(below.body.shippingFee), Number(below.body.total)]).toEqual([400, 3400]);
    const above = await placeGuestOrder(dear.id, 1);
    expect([Number(above.body.shippingFee), Number(above.body.total)]).toEqual([0, 6000]);
    // A coupon taking the products under the threshold brings the fee back.
    await createCoupon({ code: "MOINS2000", type: "fixed", value: 2000 });
    const coupon = await placeGuestOrder(dear.id, 1, { couponCode: "MOINS2000" });
    expect([Number(coupon.body.shippingFee), Number(coupon.body.total)]).toEqual([400, 4400]);

    expect((await superAdmin.put("/api/settings").send({ freeShippingThreshold: -1 })).status).toBe(400);
    expect((await superAdmin.put("/api/settings").send({ freeShippingThreshold: null })).body.freeShippingThreshold).toBeNull();
  });
});

describe("advertising pixels", () => {
  it("accepts Meta and TikTok pixel IDs and refuses anything else", async () => {
    const { agent } = await loginAs("super_admin");
    const res = await agent.put("/api/settings").send({ facebookPixelId: " 123456789012345 ", tiktokPixelId: "c4abcdefghij1234" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ facebookPixelId: "123456789012345", tiktokPixelId: "C4ABCDEFGHIJ1234" });
    for (const body of [{ facebookPixelId: "abc" }, { facebookPixelId: "12345abc" }, { tiktokPixelId: "x" }, { tiktokPixelId: "with space here" }]) {
      expect((await agent.put("/api/settings").send(body)).status).toBe(400);
    }
    expect((await agent.put("/api/settings").send({ facebookPixelId: "" })).body.facebookPixelId).toBeNull();
  });
});

describe("back-in-stock alerts", () => {
  const alerts = () => AppDataSource.getRepository(StockAlert);

  it("signs up for a sold-out product once, and refuses one in stock", async () => {
    const { shop } = await shopAdmin();
    const soldOut = await createProduct(shop.id, { stock: 0 });
    const inStock = await createProduct(shop.id, { stock: 4 });
    const signUp = (id: string, body: object) => request(app).post(`/api/products/${id}/stock-alerts`).send(body);

    expect((await signUp(soldOut.id, { email: "Amina@Example.com" })).status).toBe(201);
    expect((await signUp(soldOut.id, { email: "amina@example.com" })).status).toBe(201); // again: harmless
    expect(await alerts().count()).toBe(1);
    expect((await alerts().findOneByOrFail({ productId: soldOut.id })).email).toBe("amina@example.com");

    const available = await signUp(inStock.id, { email: "b@example.com" });
    expect(available.status).toBe(409);
    expect(available.body.code).toBe("IN_STOCK");
    expect((await signUp(soldOut.id, { email: "not-an-email" })).status).toBe(400);
    expect((await signUp(soldOut.id, {})).status).toBe(400);
    expect((await signUp(soldOut.id, { email: "c@example.com", variantId: inStock.id })).status).toBe(400); // not its option
    expect((await signUp("00000000-0000-4000-8000-000000000000", { email: "c@example.com" })).status).toBe(404);
  });

  it("uses a signed-in customer's own address", async () => {
    const { shop } = await shopAdmin();
    const soldOut = await createProduct(shop.id, { stock: 0 });
    const { agent, user } = await loginAs("customer");
    expect((await agent.post(`/api/products/${soldOut.id}/stock-alerts`).send({ email: "someone-else@example.com" })).status).toBe(201);
    expect((await alerts().findOneByOrFail({ productId: soldOut.id })).email).toBe(user.email.toLowerCase());
  });

  it("emails everyone waiting when the product is restocked, only once, in their language", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent, shop } = await shopAdmin();
    const soldOut = await createProduct(shop.id, { name: "Tajine", stock: 0 });
    await request(app).post(`/api/products/${soldOut.id}/stock-alerts`).set("Accept-Language", "fr").send({ email: "a@example.com" });
    await request(app).post(`/api/products/${soldOut.id}/stock-alerts`).set("Accept-Language", "ar").send({ email: "b@example.com" });

    await agent.put(`/api/products/${soldOut.id}`).send({ stock: 3 });
    await settleBackgroundTasks();
    expect(send).toHaveBeenCalledTimes(2);
    const byTo = Object.fromEntries(send.mock.calls.map(([template, to, email]) => [to, { template, email }]));
    expect(byTo["a@example.com"].template).toBe("back-in-stock");
    expect(byTo["a@example.com"].email.subject).toBe("De retour en stock : Tajine");
    expect(byTo["b@example.com"].email.subject).toContain("عاد إلى المخزون");
    expect(byTo["a@example.com"].email.html).toContain(`/products/${soldOut.id}`);
    expect(await alerts().countBy({ notifiedAt: Not(IsNull()) })).toBe(2);

    // Restocked again later: nobody is emailed twice.
    await agent.put(`/api/products/${soldOut.id}`).send({ stock: 0 });
    await agent.put(`/api/products/${soldOut.id}`).send({ stock: 5 });
    await settleBackgroundTasks();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("waits for the option that was asked for, and the sweep catches other restocks", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { shop } = await shopAdmin();
    const robe = await createProduct(shop.id, { name: "Robe", stock: 0 });
    const variants = AppDataSource.getRepository(ProductVariant);
    const small = await variants.save({ productId: robe.id, name: "S", stock: 0, position: 0 });
    const medium = await variants.save({ productId: robe.id, name: "M", stock: 0, position: 1 });
    expect((await request(app).post(`/api/products/${robe.id}/stock-alerts`).send({ email: "a@example.com", variantId: small.id })).status).toBe(201);

    // Another option coming back doesn't count.
    await variants.update(medium.id, { stock: 2 });
    await AppDataSource.getRepository(Product).update(robe.id, { stock: 2 });
    expect(await sendBackInStockAlerts()).toBe(0);

    // Stock returned without a product edit (e.g. a cancelled order): the
    // periodic sweep sends it.
    await variants.update(small.id, { stock: 1 });
    expect(await sendBackInStockAlerts()).toBe(1);
    expect(send.mock.calls[0][2].subject).toBe("Back in stock: Robe — S");
    expect(await sendBackInStockAlerts()).toBe(0);
  });
});
