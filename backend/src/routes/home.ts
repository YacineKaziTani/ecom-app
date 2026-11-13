import { Router } from "express";
import { z } from "zod";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { HomeBanner } from "../entities/HomeBanner";
import { Product } from "../entities/Product";
import { Shop } from "../entities/Shop";
import { COUNTED_SALE_SQL } from "../entities/Order";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { audit } from "../services/audit";
import { getStoreSettings } from "../services/storeSettings";

// The home page in one request (banners, categories, product rows, the
// featured artisan, recent reviews), plus banner management for super admins.
const router = Router();
const RAIL_SIZE = 8;

// Products shaped like the catalogue listing (shop + option count), so the
// same product card renders them.
function cards() {
  return AppDataSource.getRepository(Product)
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.shop", "shop")
    .loadRelationCountAndMap("product.variantCount", "product.variants");
}

// In-stock products that sold the most over the last 90 days (paid,
// non-cancelled orders), topped up with the best rated when there's too
// little history yet.
async function bestSellers(): Promise<Product[]> {
  const rows: { productId: string }[] = await AppDataSource.query(
    `SELECT oi."productId"
     FROM order_items oi
     JOIN orders o ON o.id = oi."orderId"
     WHERE ${COUNTED_SALE_SQL} AND o."createdAt" >= now() - interval '90 days' AND oi."productId" IS NOT NULL
     GROUP BY oi."productId"
     ORDER BY SUM(oi.quantity) DESC
     LIMIT 30`,
  );
  const ids = rows.map((r) => r.productId);
  const sold = ids.length
    ? await cards().where("product.id IN (:...ids)", { ids }).andWhere("product.stock > 0").getMany()
    : [];
  const byId = new Map(sold.map((p) => [p.id, p]));
  const ranked = ids.map((id) => byId.get(id)).filter((p): p is Product => !!p).slice(0, RAIL_SIZE);
  if (ranked.length >= RAIL_SIZE) return ranked;

  const topUp = cards().where("product.stock > 0").andWhere("product.ratingCount > 0");
  if (ranked.length) topUp.andWhere("product.id NOT IN (:...taken)", { taken: ranked.map((p) => p.id) });
  const rated = await topUp
    .orderBy("product.ratingAverage", "DESC")
    .addOrderBy("product.ratingCount", "DESC")
    .limit(RAIL_SIZE - ranked.length)
    .getMany();
  return [...ranked, ...rated];
}

// Categories that have products, with a photo: their own, or else their
// best-rated product's.
async function categoryTiles() {
  return AppDataSource.query(
    `SELECT c.id, c.name,
            COALESCE(c."imageUrl", (
              SELECT p."imageUrl" FROM products p
              WHERE p."categoryId" = c.id AND p."imageUrl" IS NOT NULL
              ORDER BY p."ratingAverage" DESC, p."createdAt" DESC LIMIT 1
            )) AS "imageUrl",
            (SELECT COUNT(*)::int FROM products p WHERE p."categoryId" = c.id) AS "productCount"
     FROM categories c
     WHERE EXISTS (SELECT 1 FROM products p WHERE p."categoryId" = c.id)
     ORDER BY "productCount" DESC, c.name ASC
     LIMIT 8`,
  );
}

// The chosen artisan, or the shop with the most products in stock.
async function featuredShop(featuredShopId: string | null) {
  const shops = AppDataSource.getRepository(Shop);
  let shop = featuredShopId ? await shops.findOne({ where: { id: featuredShopId } }) : null;
  if (!shop) {
    const [top] = await AppDataSource.query(
      `SELECT "shopId" FROM products WHERE stock > 0 GROUP BY "shopId" ORDER BY COUNT(*) DESC LIMIT 1`,
    );
    shop = top ? await shops.findOne({ where: { id: top.shopId } }) : null;
  }
  if (!shop) return null;
  const products = await cards()
    .where("product.shopId = :shopId", { shopId: shop.id })
    .andWhere("product.stock > 0")
    .orderBy("product.ratingAverage", "DESC")
    .addOrderBy("product.createdAt", "DESC")
    .limit(4)
    .getMany();
  return { shop, products };
}

// Recent 4–5 star reviews with a comment, signed "Amina B.".
async function recentReviews() {
  const rows: {
    id: string;
    rating: number;
    comment: string;
    createdAt: Date;
    firstName: string;
    lastName: string;
    productId: string;
    productName: string;
    productImage: string | null;
  }[] = await AppDataSource.query(
    `SELECT r.id, r.rating, r.comment, r."createdAt", u."firstName", u."lastName",
            p.id AS "productId", p.name AS "productName", p."imageUrl" AS "productImage"
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     JOIN products p ON p.id = r."productId"
     WHERE r.rating >= 4 AND r.comment IS NOT NULL AND length(trim(r.comment)) >= 10
     ORDER BY r."createdAt" DESC
     LIMIT 6`,
  );
  return rows.map(({ firstName, lastName, ...r }) => ({
    ...r,
    author: `${firstName} ${lastName.charAt(0)}.`,
  }));
}

// Promotions running on in-stock products, biggest discount first.
function onSale() {
  return cards()
    .where("product.stock > 0")
    .andWhere("product.compareAtPrice > product.price")
    .orderBy("(product.compareAtPrice - product.price) / product.compareAtPrice", "DESC")
    .addOrderBy("product.createdAt", "DESC")
    .limit(RAIL_SIZE)
    .getMany();
}

router.get("/", async (_req, res) => {
  const settings = await getStoreSettings();
  const [banners, categories, newArrivals, popular, featured, reviews, promotions] = await Promise.all([
    AppDataSource.getRepository(HomeBanner).find({
      where: { isActive: true },
      order: { position: "ASC", createdAt: "ASC" },
    }),
    categoryTiles(),
    cards().where("product.stock > 0").orderBy("product.createdAt", "DESC").limit(RAIL_SIZE).getMany(),
    bestSellers(),
    featuredShop(settings.featuredShopId),
    recentReviews(),
    onSale(),
  ]);
  res.set("Cache-Control", "public, max-age=60").json({
    banners,
    categories,
    newArrivals,
    bestSellers: popular,
    onSale: promotions,
    featuredShop: featured,
    reviews,
  });
});

// ---- Banners (super admin) -----------------------------------------------

const MAX_BANNERS = 8;
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

// A page of this site ("/shops", "/?category=…") or an https address.
const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^\/(?!\/)\S*$/.test(v) || /^https:\/\/\S+\.\S+$/i.test(v), {
    message: "Use a page of the site (starting with /) or an https:// link",
  })
  .transform((v) => v || null)
  .nullable()
  .optional();

const bannerSchema = z.object({
  imageUrl: z.string().trim().max(2048).regex(/^https?:\/\/.+/i, "Must be a valid http(s) URL"),
  title: z.string().trim().min(1).max(120),
  subtitle: optional(240),
  ctaLabel: optional(40),
  link: linkSchema,
  lang: z.enum(["en", "fr", "ar"]).nullable().optional(),
  position: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

const banners = () => AppDataSource.getRepository(HomeBanner);

router.get("/banners", requireAuth, requireSuperAdmin, async (_req, res) => {
  res.json(await banners().find({ order: { position: "ASC", createdAt: "ASC" } }));
});

router.post("/banners", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = bannerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  const count = await banners().count();
  if (count >= MAX_BANNERS) return res.status(400).json({ message: `At most ${MAX_BANNERS} banners` });
  const banner = await banners().save(banners().create({ position: count, ...parsed.data }));
  void audit(req, "banner.create", "banner", banner.id, { title: banner.title });
  res.status(201).json(banner);
});

router.put("/banners/:id", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = bannerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  const banner = await banners().findOne({ where: { id: req.params.id } });
  if (!banner) return res.status(404).json({ message: "Banner not found" });
  Object.assign(banner, parsed.data);
  await banners().save(banner);
  void audit(req, "banner.update", "banner", banner.id, { title: banner.title });
  res.json(banner);
});

// Saves a new order: `ids` from first to last.
router.put("/banners-order", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(MAX_BANNERS) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
  const found = await banners().find({ where: { id: In(parsed.data.ids) } });
  if (found.length !== parsed.data.ids.length) return res.status(400).json({ message: "Unknown banner" });
  await AppDataSource.transaction(async (manager) => {
    for (const [position, id] of parsed.data.ids.entries()) await manager.getRepository(HomeBanner).update(id, { position });
  });
  res.json(await banners().find({ order: { position: "ASC", createdAt: "ASC" } }));
});

router.delete("/banners/:id", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const banner = await banners().findOne({ where: { id: req.params.id } });
  if (!banner) return res.status(404).json({ message: "Banner not found" });
  await banners().delete(banner.id);
  void audit(req, "banner.delete", "banner", banner.id, { title: banner.title });
  res.status(204).send();
});

export default router;
