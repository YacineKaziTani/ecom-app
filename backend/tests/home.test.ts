import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createProduct, createShop, createUser, loginAs, placeGuestOrder } from "./helpers";
import { AppDataSource } from "../src/config/data-source";
import { Category } from "../src/entities/Category";
import { Order } from "../src/entities/Order";
import { Review } from "../src/entities/Review";
import { Shop } from "../src/entities/Shop";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

const names = (list: { name: string }[]) => list.map((p) => p.name);

async function paidSale(productId: string, quantity: number) {
  const res = await placeGuestOrder(productId, quantity, { paymentMethod: "cod" });
  expect(res.status).toBe(201);
  await AppDataSource.getRepository(Order).update(res.body.id, { paymentStatus: "paid", status: "delivered" });
}

describe("home page", () => {
  it("is empty but valid before there's anything to show", async () => {
    const res = await request(app).get("/api/home");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ banners: [], categories: [], newArrivals: [], bestSellers: [], onSale: [], featuredShop: null, reviews: [] });
  });

  it("lists new arrivals in stock, best sellers by paid sales, and category tiles with a photo", async () => {
    const { user } = await createUser({ role: "admin" });
    const shop = await createShop(user.id);
    const bowls = await AppDataSource.getRepository(Category).save({ name: "Bols" });
    const rugs = await AppDataSource.getRepository(Category).save({ name: "Tapis", imageUrl: "https://img.example/rugs.jpg" });
    const bowl = await createProduct(shop.id, { name: "Bol", categoryId: bowls.id, imageUrl: "https://img.example/bol.jpg", stock: 20 });
    const vase = await createProduct(shop.id, { name: "Vase", categoryId: bowls.id, stock: 20 });
    const rug = await createProduct(shop.id, { name: "Tapis berbère", categoryId: rugs.id, stock: 20 });
    await createProduct(shop.id, { name: "Épuisé", stock: 0 });

    await paidSale(vase.id, 3);
    await paidSale(rug.id, 1);
    // An unpaid order doesn't count.
    expect((await placeGuestOrder(bowl.id, 5, { paymentMethod: "cod" })).status).toBe(201);

    const res = await request(app).get("/api/home");
    expect(names(res.body.newArrivals)).not.toContain("Épuisé");
    expect(res.body.newArrivals).toHaveLength(3);
    expect(res.body.newArrivals[0]).toHaveProperty("shop.name");
    expect(names(res.body.bestSellers)).toEqual(["Vase", "Tapis berbère"]);
    expect(res.body.categories).toEqual([
      { id: bowls.id, name: "Bols", imageUrl: "https://img.example/bol.jpg", productCount: 2 }, // a product's photo
      { id: rugs.id, name: "Tapis", imageUrl: "https://img.example/rugs.jpg", productCount: 1 }, // its own
    ]);
  });

  it("features the chosen artisan, or else the shop with the most products", async () => {
    const small = await createShop((await createUser({ role: "admin" })).user.id, { name: "Petit atelier", slug: "petit-atelier" });
    const big = await createShop((await createUser({ role: "admin" })).user.id, { name: "Grand atelier", slug: "grand-atelier" });
    await createProduct(small.id, { name: "A" });
    await createProduct(big.id, { name: "B" });
    await createProduct(big.id, { name: "C" });

    let res = await request(app).get("/api/home");
    expect(res.body.featuredShop.shop.name).toBe("Grand atelier");
    expect(res.body.featuredShop.products).toHaveLength(2);

    const { agent } = await loginAs("super_admin");
    expect((await agent.put("/api/settings").send({ featuredShopId: small.id })).status).toBe(200);
    res = await request(app).get("/api/home");
    expect(res.body.featuredShop.shop.name).toBe("Petit atelier");
    expect((await agent.put("/api/settings").send({ featuredShopId: "00000000-0000-4000-8000-000000000000" })).status).toBe(400);

    // Deleting the featured shop falls back to the automatic choice.
    await AppDataSource.getRepository(Shop).delete(small.id);
    expect((await request(app).get("/api/settings")).body.featuredShopId).toBeNull();
    expect((await request(app).get("/api/home")).body.featuredShop.shop.name).toBe("Grand atelier");
  });

  it("shows recent good reviews that say something, signed with a first name", async () => {
    const shop = await createShop((await createUser({ role: "admin" })).user.id);
    const product = await createProduct(shop.id, { name: "Tajine" });
    const { user } = await createUser({ firstName: "Amina", lastName: "Benali" });
    const reviews = AppDataSource.getRepository(Review);
    await reviews.save({ productId: product.id, userId: user.id, rating: 5, comment: "Magnifique, très bien emballé." });
    const { user: other } = await createUser({ firstName: "Karim", lastName: "Haddad" });
    await reviews.save({ productId: product.id, userId: other.id, rating: 2, comment: "Arrivé cassé, dommage." });

    const res = await request(app).get("/api/home");
    expect(res.body.reviews).toEqual([
      expect.objectContaining({ rating: 5, author: "Amina B.", productId: product.id, productName: "Tajine" }),
    ]);
    expect(res.body.reviews[0]).not.toHaveProperty("lastName");
  });

  it("lets only a super admin manage the banners, and shows the active ones in order", async () => {
    const banner = { imageUrl: "https://img.example/b.jpg", title: "Soldes d'été", ctaLabel: "Voir", link: "/shops" };
    expect((await request(app).post("/api/home/banners").send(banner)).status).toBe(401);
    const { agent: shopAdmin } = await loginAs("admin");
    expect((await shopAdmin.post("/api/home/banners").send(banner)).status).toBe(403);

    const { agent } = await loginAs("super_admin");
    const first = await agent.post("/api/home/banners").send(banner);
    expect(first.status).toBe(201);
    const second = await agent.post("/api/home/banners").send({ ...banner, title: "Nouveautés", lang: "ar", link: "https://example.com/promo" });
    expect(second.body.position).toBe(1);
    for (const bad of [{ link: "//evil.example" }, { link: "javascript:alert(1)" }, { title: "" }, { imageUrl: "ftp://x" }, { lang: "de" }]) {
      expect((await agent.post("/api/home/banners").send({ ...banner, ...bad })).status).toBe(400);
    }

    // Reorder, then hide one.
    const reordered = await agent.put("/api/home/banners-order").send({ ids: [second.body.id, first.body.id] });
    expect(reordered.body.map((b: { title: string }) => b.title)).toEqual(["Nouveautés", "Soldes d'été"]);
    expect((await agent.put(`/api/home/banners/${first.body.id}`).send({ isActive: false })).status).toBe(200);
    const home = await request(app).get("/api/home");
    expect(home.body.banners.map((b: { title: string }) => b.title)).toEqual(["Nouveautés"]);

    expect((await agent.delete(`/api/home/banners/${second.body.id}`)).status).toBe(204);
    expect((await agent.get("/api/home/banners")).body).toHaveLength(1);
  });
});

describe("shop profile", () => {
  it("saves a cover, a story, the wilaya and social pages, and shows stats on the shop page", async () => {
    const { agent, user } = await loginAs("admin");
    const shop = await createShop(user.id, { name: "Dar Fen", slug: "dar-fen" });
    await createProduct(shop.id, { ratingAverage: 4, ratingCount: 1 });
    await createProduct(shop.id, { ratingAverage: 5, ratingCount: 3 });

    const res = await agent.put(`/api/shops/${shop.id}`).send({
      coverUrl: "https://img.example/cover.jpg",
      story: "  Potière depuis 1998 à Tlemcen.  ",
      wilayaCode: 13,
      instagramUrl: "https://instagram.com/darfen",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ story: "Potière depuis 1998 à Tlemcen.", wilayaCode: 13, coverUrl: "https://img.example/cover.jpg" });
    expect((await agent.put(`/api/shops/${shop.id}`).send({ instagramUrl: "http://instagram.com/x" })).status).toBe(400);
    expect((await agent.put(`/api/shops/${shop.id}`).send({ wilayaCode: 59 })).status).toBe(400);

    const page = await request(app).get("/api/shops/slug/dar-fen");
    expect(page.body.stats).toEqual({ productCount: 2, ratingCount: 4, ratingAverage: 4.75 });
    expect(page.body.instagramUrl).toBe("https://instagram.com/darfen");
  });
});
