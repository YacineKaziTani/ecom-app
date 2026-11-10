import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, createCoupon, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Product } from "../src/entities/Product";
import { ProductVariant } from "../src/entities/ProductVariant";
import { Category } from "../src/entities/Category";
import * as mailer from "../src/services/email";
import { settleBackgroundTasks } from "../src/utils/background";
import { parseCsv } from "../src/utils/csv";

beforeAll(initTestDb);
afterEach(async () => {
  jest.restoreAllMocks();
  delete process.env.LOW_STOCK_THRESHOLD;
  await clearDatabase();
});
afterAll(closeTestDb);

const productRow = (id: string) => AppDataSource.getRepository(Product).findOneByOrFail({ id });
const variantRow = (id: string) => AppDataSource.getRepository(ProductVariant).findOneByOrFail({ id });

async function seller() {
  const { agent, user } = await loginAs("admin");
  const shop = await createShop(user.id);
  return { agent, shop, user };
}

// A robe in three sizes; L costs more.
async function robe(agent: Awaited<ReturnType<typeof seller>>["agent"]) {
  const res = await agent.post("/api/products").send({
    name: "Robe kabyle",
    price: 6000,
    stock: 0,
    variants: [
      { name: "S", stock: 2 },
      { name: "M", stock: 5, sku: "ROBE-M" },
      { name: "L", stock: 1, price: 6500 },
    ],
  });
  expect(res.status).toBe(201);
  const [s, m, l] = res.body.variants as ProductVariant[];
  return { product: res.body as Product, s, m, l };
}

function checkout(items: { productId: string; variantId?: string | null; quantity: number }[], extra: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/orders")
    .send({
      ...DELIVERY,
      shippingAddress: "12 Rue Didouche Mourad, Alger",
      guestEmail: `guest-${Math.random().toString(36).slice(2)}@example.com`,
      paymentMethod: "cod",
      items,
      ...extra,
    });
}

describe("product options (variants)", () => {
  it("creates a product with options; its stock is their total", async () => {
    const { agent } = await seller();
    const { product, s, m, l } = await robe(agent);
    expect(product.stock).toBe(8);
    expect([s.name, m.name, l.name]).toEqual(["S", "M", "L"]);
    expect(m.sku).toBe("ROBE-M");
    expect(Number(l.price)).toBe(6500);
    expect(s.price).toBeNull();

    const detail = await request(app).get(`/api/products/${product.id}`);
    expect(detail.body.variants.map((v: ProductVariant) => v.name)).toEqual(["S", "M", "L"]);

    const list = await request(app).get("/api/products");
    expect(list.body.items[0].variantCount).toBe(3);
  });

  it("rejects two options with the same name", async () => {
    const { agent } = await seller();
    const res = await agent.post("/api/products").send({
      name: "T-shirt",
      price: 1500,
      stock: 0,
      variants: [{ name: "M", stock: 1 }, { name: "m", stock: 2 }],
    });
    expect(res.status).toBe(400);
  });

  it("replaces the option list on update: edit, swap names, remove, add", async () => {
    const { agent } = await seller();
    const { product, s, m, l } = await robe(agent);

    const res = await agent.put(`/api/products/${product.id}`).send({
      variants: [
        { id: m.id, name: "S", stock: 4 }, // M and S swap names
        { id: s.id, name: "M", stock: 3 },
        { name: "XL", stock: 7, price: 7000 },
      ], // L is dropped
    });
    expect(res.status).toBe(200);
    expect(res.body.variants.map((v: ProductVariant) => [v.name, v.stock])).toEqual([
      ["S", 4],
      ["M", 3],
      ["XL", 7],
    ]);
    expect(res.body.stock).toBe(14);
    expect(await AppDataSource.getRepository(ProductVariant).findOneBy({ id: l.id })).toBeNull();
  });

  it("keeps the stock as the options' total when only the product is edited", async () => {
    const { agent } = await seller();
    const { product } = await robe(agent);
    const res = await agent.put(`/api/products/${product.id}`).send({ stock: 999, price: 6200 });
    expect(res.status).toBe(200);
    expect(res.body.stock).toBe(8);
    expect(Number(res.body.price)).toBe(6200);
  });

  it("refuses option ids that belong to another product", async () => {
    const { agent } = await seller();
    const { product } = await robe(agent);
    const other = await robe(agent).catch(() => null); // same name is fine across products
    expect(other).not.toBeNull();
    const res = await agent.put(`/api/products/${product.id}`).send({
      variants: [{ id: other!.s.id, name: "S", stock: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it("removing every option makes the product's own stock count again", async () => {
    const { agent } = await seller();
    const { product } = await robe(agent);
    const res = await agent.put(`/api/products/${product.id}`).send({ variants: [], stock: 12 });
    expect(res.body.variants).toEqual([]);
    expect(res.body.stock).toBe(12);
  });
});

describe("checkout with options", () => {
  it("sells the chosen option at its own price and takes it from that option's stock", async () => {
    const { agent } = await seller();
    const { product, m, l } = await robe(agent);

    const res = await checkout([
      { productId: product.id, variantId: l.id, quantity: 1 },
      { productId: product.id, variantId: m.id, quantity: 2 },
    ]);
    expect(res.status).toBe(201);
    const items = res.body.items as { variantName: string; price: string; quantity: number }[];
    expect(items.map((i) => [i.variantName, Number(i.price), i.quantity]).sort()).toEqual([
      ["L", 6500, 1],
      ["M", 6000, 2],
    ]);
    expect(Number(res.body.subtotal)).toBe(18500);
    expect((await variantRow(l.id)).stock).toBe(0);
    expect((await variantRow(m.id)).stock).toBe(3);
    expect((await productRow(product.id)).stock).toBe(5);
  });

  it("asks for an option when the product has some", async () => {
    const { agent } = await seller();
    const { product } = await robe(agent);
    const res = await checkout([{ productId: product.id, quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VARIANT_REQUIRED");
  });

  it("checks stock per option, and merges repeated lines first", async () => {
    const { agent } = await seller();
    const { product, s } = await robe(agent);
    const res = await checkout([
      { productId: product.id, variantId: s.id, quantity: 1 },
      { productId: product.id, variantId: s.id, quantity: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.issues).toEqual([
      expect.objectContaining({ variantId: s.id, variantName: "S", availableStock: 2, requestedQuantity: 3 }),
    ]);
    expect((await variantRow(s.id)).stock).toBe(2);
  });

  it("an option of another product counts as unavailable", async () => {
    const { agent, shop } = await seller();
    const { s } = await robe(agent);
    const plain = await createProduct(shop.id);
    const res = await checkout([{ productId: plain.id, variantId: s.id, quantity: 1 }]);
    expect(res.status).toBe(409);
  });

  it("cancelling restocks the option; reactivating takes it again", async () => {
    const { agent } = await seller();
    const { product, m } = await robe(agent);
    const order = await checkout([{ productId: product.id, variantId: m.id, quantity: 4 }]);
    const { agent: admin } = await loginAs("super_admin");

    await admin.patch(`/api/orders/${order.body.id}/status`).send({ status: "cancelled" }).expect(200);
    expect((await variantRow(m.id)).stock).toBe(5);
    expect((await productRow(product.id)).stock).toBe(8);

    await admin.patch(`/api/orders/${order.body.id}/status`).send({ status: "pending" }).expect(200);
    expect((await variantRow(m.id)).stock).toBe(1);
    expect((await productRow(product.id)).stock).toBe(4);
  });

  it("cancelling an order whose option was deleted since just skips that line", async () => {
    const { agent } = await seller();
    const { product, s, m } = await robe(agent);
    const order = await checkout([{ productId: product.id, variantId: s.id, quantity: 1 }]);
    await agent.put(`/api/products/${product.id}`).send({ variants: [{ id: m.id, name: "M", stock: 5 }] }).expect(200);

    const { agent: admin } = await loginAs("super_admin");
    const res = await admin.patch(`/api/orders/${order.body.id}/status`).send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect((await productRow(product.id)).stock).toBe(5);
  });

  it("previews coupons against option prices", async () => {
    const { agent } = await seller();
    const { product, l } = await robe(agent);
    await createCoupon({ code: "DIX", type: "percentage", value: 10 });
    const res = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "DIX", items: [{ productId: product.id, variantId: l.id, quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(13000);
    expect(res.body.discountAmount).toBe(1300);
  });
});

describe("cart lines with options", () => {
  it("keeps one line per product + option and sums repeated adds", async () => {
    const { agent: shopAgent, shop } = await seller();
    const { product, s, m } = await robe(shopAgent);
    const plain = await createProduct(shop.id, { stock: 20 });
    const { agent } = await loginAs("customer");

    await agent.post("/api/cart").send({ productId: plain.id, quantity: 1 }).expect(201);
    await agent.post("/api/cart").send({ productId: plain.id, quantity: 2 }).expect(201);
    await agent.post("/api/cart").send({ productId: product.id, variantId: s.id }).expect(201);
    const res = await agent.post("/api/cart").send({ productId: product.id, variantId: m.id, quantity: 3 });

    expect(res.body.lines.map((l: any) => [l.productId, l.variant?.name ?? null, l.quantity])).toEqual([
      [plain.id, null, 3],
      [product.id, "S", 1],
      [product.id, "M", 3],
    ]);
  });

  it("requires an option for products that have some", async () => {
    const { agent: shopAgent } = await seller();
    const { product } = await robe(shopAgent);
    const { agent } = await loginAs("customer");
    const res = await agent.post("/api/cart").send({ productId: product.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VARIANT_REQUIRED");
  });

  it("updates and removes a single option's line", async () => {
    const { agent: shopAgent } = await seller();
    const { product, s, m } = await robe(shopAgent);
    const { agent } = await loginAs("customer");
    await agent.post("/api/cart").send({ productId: product.id, variantId: s.id }).expect(201);
    await agent.post("/api/cart").send({ productId: product.id, variantId: m.id }).expect(201);

    const patched = await agent.patch(`/api/cart/${product.id}?variantId=${m.id}`).send({ quantity: 4 });
    expect(patched.body.lines.map((l: any) => l.quantity)).toEqual([1, 4]);

    const removed = await agent.delete(`/api/cart/${product.id}?variantId=${s.id}`);
    expect(removed.body.lines.map((l: any) => l.variantId)).toEqual([m.id]);
  });

  it("merging a guest cart skips lines that can't be bought any more", async () => {
    const { agent: shopAgent, shop } = await seller();
    const { product, s } = await robe(shopAgent);
    const plain = await createProduct(shop.id);
    const { agent } = await loginAs("customer");
    const res = await agent.post("/api/cart/merge").send({
      items: [
        { productId: plain.id, quantity: 1 },
        { productId: product.id, variantId: s.id, quantity: 2 },
        { productId: product.id, quantity: 1 }, // option missing
        { productId: plain.id, variantId: s.id, quantity: 1 }, // option of another product
      ],
    });
    expect(res.body.lines.map((l: any) => [l.productId, l.variantId, l.quantity])).toEqual([
      [plain.id, null, 1],
      [product.id, s.id, 2],
    ]);
  });
});

describe("catalog browsing", () => {
  it("filters by price and stock, and sorts by rating", async () => {
    const { shop } = await seller();
    await createProduct(shop.id, { name: "Cheap", price: 500, stock: 3, ratingAverage: 3, ratingCount: 2 });
    await createProduct(shop.id, { name: "Mid", price: 2000, stock: 0, ratingAverage: 5, ratingCount: 1 });
    await createProduct(shop.id, { name: "Dear", price: 9000, stock: 1, ratingAverage: 4.5, ratingCount: 8 });

    const names = async (query: string) =>
      (await request(app).get(`/api/products?${query}`)).body.items.map((p: Product) => p.name);

    expect(await names("minPrice=1000&maxPrice=5000")).toEqual(["Mid"]);
    expect((await names("inStock=true")).sort()).toEqual(["Cheap", "Dear"]);
    expect(await names("sort=rating_desc")).toEqual(["Mid", "Dear", "Cheap"]);
    expect((await names("minPrice=abc")).length).toBe(3); // malformed filters are ignored
  });

  it("fetches a given set of products by id (recently viewed)", async () => {
    const { shop } = await seller();
    const a = await createProduct(shop.id, { name: "A" });
    await createProduct(shop.id, { name: "B" });
    const c = await createProduct(shop.id, { name: "C" });
    const res = await request(app).get(`/api/products?ids=${a.id},${c.id},not-a-uuid`);
    expect(res.body.items.map((p: Product) => p.name).sort()).toEqual(["A", "C"]);
    expect((await request(app).get("/api/products?ids=nope")).body.items).toEqual([]);
  });

  it("suggests related products: same category first, in stock, never itself", async () => {
    const { shop } = await seller();
    const { user } = await loginAs("admin");
    const otherShop = await createShop(user.id);
    const category = await AppDataSource.getRepository(Category).save({ name: "Poterie" });
    const base = await createProduct(shop.id, { name: "Vase", categoryId: category.id });
    await createProduct(otherShop.id, { name: "Bol", categoryId: category.id, ratingAverage: 1 });
    await createProduct(shop.id, { name: "Tapis", ratingAverage: 5 }); // same shop, other category
    await createProduct(otherShop.id, { name: "Plat", categoryId: category.id, stock: 0 }); // sold out
    await createProduct(otherShop.id, { name: "Lampe" }); // unrelated

    const res = await request(app).get(`/api/products/${base.id}/related`);
    expect(res.status).toBe(200);
    expect(res.body.map((p: Product) => p.name)).toEqual(["Bol", "Tapis"]);
  });
});

describe("low-stock alerts", () => {
  it("emails the shop owner once when an option falls to the threshold", async () => {
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { agent } = await seller();
    const { product, m } = await robe(agent); // M: 5 in stock, threshold 3

    await checkout([{ productId: product.id, variantId: m.id, quantity: 1 }]).expect(201); // 4 left
    await settleBackgroundTasks();
    expect(send.mock.calls.filter(([t]) => t === "low-stock")).toHaveLength(0);

    await checkout([{ productId: product.id, variantId: m.id, quantity: 2 }]).expect(201); // 2 left
    await checkout([{ productId: product.id, variantId: m.id, quantity: 1 }]).expect(201); // 1 left
    await settleBackgroundTasks();
    const alerts = send.mock.calls.filter(([t]) => t === "low-stock");
    expect(alerts).toHaveLength(1);
    expect(alerts[0][2].subject).toContain("Robe kabyle — M");
    expect(alerts[0][2].text).toContain("2 left");
  });

  it("can be tuned with LOW_STOCK_THRESHOLD (0 = only when sold out)", async () => {
    process.env.LOW_STOCK_THRESHOLD = "0";
    const send = jest.spyOn(mailer, "sendEmail").mockResolvedValue(true);
    const { shop } = await seller();
    const plain = await createProduct(shop.id, { name: "Savon", stock: 2 });
    await checkout([{ productId: plain.id, quantity: 1 }]).expect(201);
    await settleBackgroundTasks();
    expect(send.mock.calls.filter(([t]) => t === "low-stock")).toHaveLength(0);
    await checkout([{ productId: plain.id, quantity: 1 }]).expect(201);
    await settleBackgroundTasks();
    const [alert] = send.mock.calls.filter(([t]) => t === "low-stock");
    expect(alert[2].subject).toMatch(/^Sold out: Savon/);
  });
});

describe("CSV import", () => {
  it("parses quotes, escaped quotes, newlines in fields and ; delimiters", () => {
    expect(parseCsv('﻿name,description\r\n"Bol, grand","Dit ""le bleu""\nfait main"\r\n\r\n')).toEqual([
      ["name", "description"],
      ["Bol, grand", 'Dit "le bleu"\nfait main'],
    ]);
    expect(parseCsv("nom;prix\nTapis;1 200,50")).toEqual([["nom", "prix"], ["Tapis", "1 200,50"]]);
  });

  it("creates new products and updates existing ones by name", async () => {
    const { agent, shop } = await seller();
    await AppDataSource.getRepository(Category).save({ name: "Poterie" });
    const existing = await createProduct(shop.id, { name: "Vase bleu", price: 1000, stock: 1 });

    const csv = [
      "name;price;stock;category;description",
      "Vase bleu;1 250,00;9;;",
      'Tajine;3500;4;poterie;"Terre cuite; fait main"',
    ].join("\n");

    const preview = await agent.post("/api/products/import").send({ csv, dryRun: true });
    expect(preview.body).toEqual({ created: 1, updated: 1, dryRun: true });
    expect((await productRow(existing.id)).stock).toBe(1); // dry run saves nothing

    const res = await agent.post("/api/products/import").send({ csv });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 1, updated: 1 });
    const vase = await productRow(existing.id);
    expect([Number(vase.price), vase.stock]).toEqual([1250, 9]);
    const tajine = await AppDataSource.getRepository(Product).findOneOrFail({ where: { name: "Tajine" }, relations: ["category"] });
    expect(tajine).toMatchObject({ shopId: shop.id, stock: 4, description: "Terre cuite; fait main" });
    expect(tajine.category?.name).toBe("Poterie");
  });

  it("imports nothing when any line is wrong, and says which lines", async () => {
    const { agent } = await seller();
    const csv = ["name,price,stock,category", "Bol,900,2,", ",500,1,", "Plat,abc,1,", "Lampe,800,1,Inconnue", "Bol,950,1,"].join("\n");
    const res = await agent.post("/api/products/import").send({ csv });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { line: number }) => e.line)).toEqual([3, 4, 5, 6]);
    expect(await AppDataSource.getRepository(Product).count()).toBe(0);
  });

  it("won't overwrite the stock of a product that has options", async () => {
    const { agent } = await seller();
    await robe(agent);
    const res = await agent.post("/api/products/import").send({ csv: "name,price,stock\nRobe kabyle,6000,50" });
    expect(res.status).toBe(400);
    const ok = await agent.post("/api/products/import").send({ csv: "name,price\nRobe kabyle,6100" });
    expect(ok.status).toBe(201);
  });

  it("needs name and price columns; a super admin picks the shop", async () => {
    const { agent } = await seller();
    expect((await agent.post("/api/products/import").send({ csv: "title,cost\nBol,900" })).status).toBe(400);

    const { agent: admin } = await loginAs("super_admin");
    expect((await admin.post("/api/products/import").send({ csv: "name,price\nBol,900" })).status).toBe(400);
    const { shop } = await seller();
    const res = await admin.post("/api/products/import").send({ csv: "name,price\nBol,900", shopId: shop.id });
    expect(res.status).toBe(201);
  });

  it("is for shop staff only", async () => {
    const { agent } = await loginAs("customer");
    expect((await agent.post("/api/products/import").send({ csv: "name,price\nBol,900" })).status).toBe(403);
  });
});
