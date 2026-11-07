import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { imageUrlSchema, nameSchema, shortTextSchema } from "../utils/validators";
import { paginated, parsePagination } from "../utils/pagination";
import { audit } from "../services/audit";

const router = Router();
const repo = () => AppDataSource.getRepository(Product);

const SORT_OPTIONS = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function isSortOption(value: unknown): value is SortOption {
  return (
    typeof value === "string" &&
    (SORT_OPTIONS as readonly string[]).includes(value)
  );
}

router.get("/", async (req, res) => {
  const { search, categoryId, shopId, sort } = req.query as Record<
    string,
    string
  >;
  const pageParams = parsePagination(req.query, 12);

  const qb = repo()
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.shop", "shop");

  if (search) {
    qb.andWhere(
      "(product.name ILIKE :search OR product.description ILIKE :search)",
      {
        search: `%${search.slice(0, 200)}%`,
      },
    );
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

  qb.take(pageParams.limit).skip(pageParams.skip);

  const [items, total] = await qb.getManyAndCount();
  res.json(paginated(items, total, pageParams));
});

router.get("/:id", validateUuidParam(), async (req, res) => {
  const product = await repo().findOne({
    where: { id: req.params.id },
    relations: ["category", "shop"],
  });
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

const productSchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  imageUrl: imageUrlSchema,
  // Extra gallery photos (in display order).
  galleryUrls: z
    .array(z.string().trim().max(2048).regex(/^https?:\/\/.+/i, "Must be a valid http(s) URL"))
    .max(8)
    .optional(),
  categoryId: z.string().uuid().nullable().optional(), // null clears it
});

router.post("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  // A super_admin picks the shop; a shop admin always creates in their own.
  const isSuperAdmin = req.user!.role === "super_admin";
  const parsed = productSchema
    .extend({ shopId: isSuperAdmin ? z.string().uuid() : z.any() })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { shopId: requestedShopId, ...data } = parsed.data;
  const shopId: string = isSuperAdmin ? requestedShopId : req.shopId!;

  const product = repo().create({ ...data, shopId });
  await repo().save(product);
  res.status(201).json(product);
});

router.put(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.flatten() });

    const product = await repo().findOne({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.user!.role !== "super_admin" && product.shopId !== req.shopId) {
      return res
        .status(403)
        .json({ message: "You can only edit products in your own shop" });
    }

    Object.assign(product, parsed.data);
    await repo().save(product);
    res.json(product);
  },
);

router.delete(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const product = await repo().findOne({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.user!.role !== "super_admin" && product.shopId !== req.shopId) {
      return res
        .status(403)
        .json({ message: "You can only delete products in your own shop" });
    }

    await repo().delete(product.id);
    void audit(req, "product.delete", "product", product.id, { name: product.name, shopId: product.shopId });
    res.status(204).send();
  },
);

export default router;
