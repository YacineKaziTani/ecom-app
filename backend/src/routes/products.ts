import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { imageUrlSchema, nameSchema, shortTextSchema, clampInt } from "../utils/validators";

const router = Router();
const repo = () => AppDataSource.getRepository(Product);

const SORT_OPTIONS = ["newest", "oldest", "price_asc", "price_desc", "name_asc"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function isSortOption(value: unknown): value is SortOption {
  return typeof value === "string" && (SORT_OPTIONS as readonly string[]).includes(value);
}

// GET /api/products?search=&categoryId=&shopId=&sort=&page=&limit=
router.get("/", async (req, res) => {
  const { search, categoryId, shopId, sort } = req.query as Record<string, string>;
  const take = clampInt(req.query.limit, 12, 1, 100);
  const page = clampInt(req.query.page, 1, 1, 100_000);
  const skip = (page - 1) * take;

  const qb = repo()
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.shop", "shop");

  if (search) {
    // Matches name OR description, case-insensitively — previously this only
    // searched name, so a product findable only by a term in its description
    // (e.g. "gift-wrapped", "handmade in Oran") never showed up at all.
    qb.andWhere("(product.name ILIKE :search OR product.description ILIKE :search)", {
      search: `%${search.slice(0, 200)}%`,
    });
  }
  if (categoryId && z.string().uuid().safeParse(categoryId).success) {
    qb.andWhere("product.categoryId = :categoryId", { categoryId });
  }
  if (shopId && z.string().uuid().safeParse(shopId).success) {
    qb.andWhere("product.shopId = :shopId", { shopId });
  }

  const sortOption: SortOption = isSortOption(sort) ? sort : "newest";
  switch (sortOption) {
    case "price_asc":
      qb.orderBy("product.price", "ASC");
      break;
    case "price_desc":
      qb.orderBy("product.price", "DESC");
      break;
    case "name_asc":
      qb.orderBy("product.name", "ASC");
      break;
    case "oldest":
      qb.orderBy("product.createdAt", "ASC");
      break;
    case "newest":
    default:
      qb.orderBy("product.createdAt", "DESC");
      break;
  }

  qb.take(take).skip(skip);

  const [items, total] = await qb.getManyAndCount();

  res.json({ items, total, page, limit: take, totalPages: Math.ceil(total / take) });
});

router.get("/:id", validateUuidParam(), async (req, res) => {
  const product = await repo().findOne({ where: { id: req.params.id }, relations: ["category", "shop"] });
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

const productSchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  imageUrl: imageUrlSchema,
  categoryId: z.string().uuid().optional(),
});

// Admin: creates a product under THEIR shop (attachShop resolves req.shopId).
// Super_admin: must pass shopId explicitly in the body since they have no shop of their own.
router.post("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const schema = req.user!.role === "super_admin" ? productSchema.extend({ shopId: z.string().uuid() }) : productSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const shopId = req.user!.role === "super_admin" ? (parsed.data as any).shopId : req.shopId!;

  const product = repo().create({ ...parsed.data, shopId });
  await repo().save(product);
  res.status(201).json(product);
});

router.put("/:id", validateUuidParam(), requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const product = await repo().findOne({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (req.user!.role !== "super_admin" && product.shopId !== req.shopId) {
    return res.status(403).json({ message: "You can only edit products in your own shop" });
  }

  Object.assign(product, parsed.data);
  await repo().save(product);
  res.json(product);
});

router.delete("/:id", validateUuidParam(), requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const product = await repo().findOne({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (req.user!.role !== "super_admin" && product.shopId !== req.shopId) {
    return res.status(403).json({ message: "You can only delete products in your own shop" });
  }

  await repo().delete(product.id);
  res.status(204).send();
});

export default router;
