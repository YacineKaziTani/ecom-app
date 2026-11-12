import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { Shop } from "../entities/Shop";
import { escapeHtml } from "../utils/escapeHtml";
import { formatDzd } from "../utils/money";

// Served through the frontend's domain via vercel.json rewrites:
//   /sitemap.xml, /robots.txt            → always
//   /, /products/:id, /shops/:slug       → only for link-preview crawlers
//     (WhatsApp, Facebook, Telegram, X…), which don't run JavaScript and
//     would otherwise see an empty single-page app with no title or image.
const router = Router();
const siteUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
const SITE_NAME = "ArtisanShop";

// 1200×630 is the size link previews expect.
function previewImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/")
    ? url.replace("/image/upload/", "/image/upload/c_fill,w_1200,h_630,f_jpg,q_auto/")
    : url;
}

function previewPage(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
}): string {
  const url = `${siteUrl()}${opts.path}`;
  const t = escapeHtml(opts.title);
  const d = escapeHtml(opts.description.slice(0, 300));
  const image = opts.image ? escapeHtml(opts.image) : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${t} — ${SITE_NAME}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="${opts.type ?? "website"}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapeHtml(url)}" />
${image ? `<meta property="og:image" content="${image}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${escapeHtml(url)}">View on ${SITE_NAME}</a></p>
</body>
</html>`;
}

// The home page: the site's own preview image (frontend/public/og-image.png).
router.get("/home", (_req, res) => {
  res
    .set("Cache-Control", "public, max-age=3600")
    .type("html")
    .send(
      previewPage({
        title: "Curated goods from independent makers",
        description:
          "Premium goods made by independent artisans, shipped from their workshops. Pay on delivery or by EDAHABIA / CIB card.",
        path: "/",
        image: `${siteUrl()}/og-image.png`,
      }),
    );
});

router.get("/products/:id", async (req, res) => {
  const product = /^[0-9a-f-]{36}$/i.test(req.params.id)
    ? await AppDataSource.getRepository(Product).findOne({ where: { id: req.params.id }, relations: ["shop"] })
    : null;
  if (!product) return res.status(404).type("html").send(previewPage({ title: "Product not found", description: "", path: "/" }));
  res
    .set("Cache-Control", "public, max-age=600")
    .type("html")
    .send(
      previewPage({
        title: product.name,
        description: `${formatDzd(product.price)}${product.shop ? ` · by ${product.shop.name}` : ""}. ${product.description ?? ""}`,
        path: `/products/${product.id}`,
        image: previewImage(product.imageUrl),
        type: "product",
      }),
    );
});

router.get("/shops/:slug", async (req, res) => {
  const shop = /^[a-z0-9-]{1,150}$/.test(req.params.slug)
    ? await AppDataSource.getRepository(Shop).findOne({ where: { slug: req.params.slug } })
    : null;
  if (!shop) return res.status(404).type("html").send(previewPage({ title: "Shop not found", description: "", path: "/shops" }));
  res
    .set("Cache-Control", "public, max-age=600")
    .type("html")
    .send(
      previewPage({
        title: shop.name,
        description: shop.description || `Handmade goods from ${shop.name} on ${SITE_NAME}.`,
        path: `/shops/${shop.slug}`,
        image: previewImage(shop.logoUrl),
      }),
    );
});

router.get("/sitemap.xml", async (_req, res) => {
  const [products, shops] = await Promise.all([
    AppDataSource.getRepository(Product).find({ select: { id: true, updatedAt: true }, order: { updatedAt: "DESC" }, take: 45_000 }),
    AppDataSource.getRepository(Shop).find({ select: { slug: true, updatedAt: true } }),
  ]);
  const entry = (path: string, lastmod?: Date) =>
    `  <url><loc>${escapeHtml(siteUrl() + path)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`;
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entry("/"),
    entry("/shops"),
    entry("/sell"),
    entry("/contact"),
    entry("/delivery-returns"),
    entry("/terms"),
    entry("/privacy"),
    ...shops.map((s) => entry(`/shops/${s.slug}`, s.updatedAt)),
    ...products.map((p) => entry(`/products/${p.id}`, p.updatedAt)),
    `</urlset>`,
  ].join("\n");
  res.set("Cache-Control", "public, max-age=3600").type("application/xml").send(xml);
});

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Disallow: /dashboard",
      "Disallow: /cart",
      "Disallow: /orders",
      "Disallow: /profile",
      "Disallow: /wishlist",
      "Disallow: /order-confirmation",
      "Disallow: /payment",
      "Disallow: /reset-password",
      "Disallow: /verify-email",
      `Sitemap: ${siteUrl()}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

export default router;
