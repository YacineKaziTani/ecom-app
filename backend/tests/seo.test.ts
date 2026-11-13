import request from "supertest";
import { app } from "../src/app";
import { initTestDb, closeTestDb, clearDatabase } from "./testDb";
import { createShop, createProduct, createUser } from "./helpers";

beforeAll(initTestDb);
afterEach(clearDatabase);
afterAll(closeTestDb);

async function catalog() {
  const { user } = await createUser({ role: "admin" });
  const shop = await createShop(user.id, { name: "Dar El Fen", slug: "dar-el-fen", description: "Céramique & tissage" });
  const product = await createProduct(shop.id, {
    name: `Bol "émaillé" <b>bleu</b>`,
    price: 2500,
    imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/bol.jpg",
  });
  return { shop, product };
}

describe("SEO endpoints", () => {
  it("serves a sitemap with every shop and product", async () => {
    const { shop, product } = await catalog();
    const res = await request(app).get("/api/seo/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.type).toBe("application/xml");
    expect(res.text).toContain(`/shops/${shop.slug}</loc>`);
    expect(res.text).toContain(`/products/${product.id}</loc>`);
  });

  it("serves robots.txt pointing at the sitemap and hiding private pages", async () => {
    const res = await request(app).get("/api/seo/robots.txt");
    expect(res.text).toMatch(/Disallow: \/dashboard/);
    expect(res.text).toMatch(/Sitemap: http.+\/sitemap\.xml/);
  });

  it("gives link-preview crawlers a page with escaped Open Graph tags", async () => {
    const { product } = await catalog();
    const res = await request(app).get(`/api/seo/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('property="og:title" content="Bol &quot;émaillé&quot; &lt;b&gt;bleu&lt;/b&gt;"');
    expect(res.text).not.toContain("<b>bleu</b>");
    expect(res.text).toContain("c_fill,w_1200,h_630");
    expect(res.text).toMatch(/2\s500\sDA/);
  });

  it("previews shops and 404s unknown ones", async () => {
    await catalog();
    expect((await request(app).get("/api/seo/shops/dar-el-fen")).text).toContain("Céramique &amp; tissage");
    expect((await request(app).get("/api/seo/shops/nope")).status).toBe(404);
    expect((await request(app).get("/api/seo/products/not-a-uuid")).status).toBe(404);
  });
});
