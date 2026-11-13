import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { loginAs, createShop, createProduct, DELIVERY } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Category } from "../src/entities/Category";
import { Product } from "../src/entities/Product";
import { communesOf, findCommune, normalizeName } from "../src/services/communes";
import { COMMUNES } from "../src/data/communes";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

describe("communes", () => {
  it("has the 1,541 communes of the 58 wilayas", () => {
    expect(COMMUNES).toHaveLength(1541);
    expect(new Set(COMMUNES.map(([w]) => w)).size).toBe(58);
    expect(communesOf(16).map((c) => c.name)).toEqual(expect.arrayContaining(["Alger Centre", "Hydra", "Bab Ezzouar"]));
  });

  it("finds a commune by its Latin or Arabic name, however it's typed", () => {
    expect(normalizeName("  Bab-EZZOUAR ")).toBe("bab ezzouar");
    expect(findCommune(16, "bab ezzouar")?.name).toBe("Bab Ezzouar");
    expect(findCommune(16, "باب الزوار")?.name).toBe("Bab Ezzouar");
    expect(findCommune(16, "Oran")).toBeNull(); // another wilaya's commune
    expect(findCommune(16, "")).toBeNull();
  });

  it("lists a wilaya's communes for the dropdowns", async () => {
    const res = await request(app).get("/api/shipping/zones/31/communes");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age");
    expect(res.body).toEqual(expect.arrayContaining([{ name: "Oran", nameAr: "وهران" }]));
    expect((await request(app).get("/api/shipping/zones/abc/communes")).status).toBe(400);
    expect((await request(app).get("/api/shipping/zones/99/communes")).body).toEqual([]);
  });

  it("checkout needs a commune of the chosen wilaya, stored with its official spelling", async () => {
    const { user } = await loginAs("admin");
    const shop = await createShop(user.id);
    const product = await createProduct(shop.id);
    const order = (commune: string) =>
      request(app).post("/api/orders").send({
        ...DELIVERY,
        commune,
        shippingAddress: "Rue 1",
        guestEmail: "c@example.com",
        paymentMethod: "cod",
        items: [{ productId: product.id, quantity: 1 }],
      });

    const wrong = await order("Oran");
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("COMMUNE_INVALID");

    const arabic = await order("الجزائر الوسطى");
    expect(arabic.status).toBe(201);
    expect(arabic.body.commune).toBe("Alger Centre");
  });

  it("saved addresses need a valid commune too, including when the wilaya changes", async () => {
    const { agent } = await loginAs("customer");
    const body = { label: "Maison", phone: "0550112233", wilayaCode: 16, commune: "hydra", address: "Rue 1" };
    expect((await agent.post("/api/addresses").send({ ...body, commune: "Nowhere" })).body.code).toBe("COMMUNE_INVALID");
    const created = await agent.post("/api/addresses").send(body);
    expect(created.body.commune).toBe("Hydra");

    // Moving it to Oran without changing the commune is refused...
    const moved = await agent.put(`/api/addresses/${created.body.id}`).send({ wilayaCode: 31 });
    expect(moved.body.code).toBe("COMMUNE_INVALID");
    // ...with one of Oran's communes it's fine.
    const ok = await agent.put(`/api/addresses/${created.body.id}`).send({ wilayaCode: 31, commune: "Es Senia" });
    expect(ok.body).toMatchObject({ wilayaCode: 31, commune: "Es Senia" });
  });
});

describe("product search", () => {
  async function catalogue() {
    const { user } = await loginAs("admin");
    const shop = await createShop(user.id, { name: "Atelier Nour", slug: "atelier-nour" });
    const poterie = await AppDataSource.getRepository(Category).save({ name: "Poterie" });
    await createProduct(shop.id, { name: "Théière en cuivre", description: "Gravée à la main" });
    await createProduct(shop.id, { name: "Tajine marocain", categoryId: poterie.id });
    await createProduct(shop.id, { name: "Plateau", description: "Pour servir la théière" });
    await createProduct(shop.id, { name: "أواني فخارية", description: "صناعة يدوية" });
    const { user: other } = await loginAs("admin");
    const otherShop = await createShop(other.id, { name: "Maison Lina", slug: "maison-lina" });
    await createProduct(otherShop.id, { name: "Coussin brodé" });
  }
  const names = async (query: string) =>
    (await request(app).get("/api/products").query({ search: query })).body.items.map((p: Product) => p.name);

  it("ignores case and accents", async () => {
    await catalogue();
    expect(await names("THEIERE")).toEqual(["Théière en cuivre", "Plateau"]); // name match first
    expect(await names("brode")).toEqual(["Coussin brodé"]);
  });

  it("needs every word, in any order and any field", async () => {
    await catalogue();
    expect(await names("cuivre theiere")).toEqual(["Théière en cuivre"]);
    expect(await names("theiere bois")).toEqual([]);
    expect(await names("gravee main")).toEqual(["Théière en cuivre"]); // description
  });

  it("finds products by their category or shop name", async () => {
    await catalogue();
    expect(await names("poterie")).toEqual(["Tajine marocain"]);
    expect((await names("atelier nour")).sort()).toEqual(["Plateau", "Tajine marocain", "Théière en cuivre", "أواني فخارية"].sort());
  });

  it("forgives small typos in a product name", async () => {
    await catalogue();
    expect(await names("tajin")).toEqual(["Tajine marocain"]);
    expect(await names("taj")).toEqual(["Tajine marocain"]); // short: plain "contains"
  });

  it("handles Arabic letter variants", async () => {
    await catalogue();
    expect(await names("اواني")).toEqual(["أواني فخارية"]);
    expect(await names("يدويه")).toEqual(["أواني فخارية"]); // ة written as ه
  });

  it("suggests the closest product when nothing matches, and treats % and _ literally", async () => {
    await catalogue();
    const res = await request(app).get("/api/products").query({ search: "tagine" });
    expect(res.body.items).toEqual([]);
    expect(res.body.suggestion).toBe("Tajine marocain");
    expect((await request(app).get("/api/products").query({ search: "zzzzqqq" })).body.suggestion).toBeNull();
    // With other filters the suggestion could be the empty result itself, so none is offered.
    expect((await request(app).get("/api/products").query({ search: "tagine", inStock: "true" })).body.suggestion).toBeNull();
    expect((await request(app).get("/api/products").query({ search: "tagine", minPrice: "1" })).body.suggestion).toBeNull();
    expect(await names("%")).toEqual([]);
    expect(await names("_")).toEqual([]);
  });

  it("keeps the other filters and an explicit sort working with a search", async () => {
    await catalogue();
    const res = await request(app).get("/api/products").query({ search: "theiere", sort: "name_asc" });
    expect(res.body.items.map((p: Product) => p.name)).toEqual(["Plateau", "Théière en cuivre"]);
    expect(res.body.total).toBe(2);
  });

  it("suggests products, categories and shops as the customer types", async () => {
    await catalogue();
    const res = await request(app).get("/api/search/suggest").query({ q: "pot" });
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([expect.objectContaining({ name: "Poterie" })]);
    expect(res.body.products.map((p: Product) => p.name)).toEqual(["Tajine marocain"]);

    const shops = await request(app).get("/api/search/suggest").query({ q: "maison" });
    expect(shops.body.shops).toEqual([expect.objectContaining({ name: "Maison Lina", slug: "maison-lina" })]);

    expect((await request(app).get("/api/search/suggest").query({ q: "a" })).body).toEqual({ products: [], categories: [], shops: [] });
  });
});
