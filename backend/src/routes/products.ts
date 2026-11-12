import { Router } from "express";
import { z } from "zod";
import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { Category } from "../entities/Category";
import { Shop } from "../entities/Shop";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { imageUrlSchema, nameSchema, shortTextSchema } from "../utils/validators";
import { paginated, parsePagination } from "../utils/pagination";
import { HttpError } from "../utils/httpError";
import { parseCsv } from "../utils/csv";
import { audit } from "../services/audit";
import { lockStock } from "../services/inventory";
import { applySearch, orderByRelevance, suggestionFor } from "../services/productSearch";

const router = Router();
const repo = () => AppDataSource.getRepository(Product);

const SORT_OPTIONS = [
  "relevance", // best matches first — the default when searching
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "rating_desc",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function isSortOption(value: unknown): value is SortOption {
  return (
    typeof value === "string" &&
    (SORT_OPTIONS as readonly string[]).includes(value)
  );
}

function priceParam(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Listing filters: search, categoryId, shopId, minPrice, maxPrice,
// inStock=true, ids (comma-separated, e.g. "recently viewed"), sort. Each product carries `variantCount` so a card can offer
// "choose options" instead of a one-click add to cart.
router.get("/", async (req, res) => {
  const { search, categoryId, shopId, sort, inStock } = req.query as Record<
    string,
    string
  >;
  const pageParams = parsePagination(req.query, 12);

  const qb = repo()
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.shop", "shop")
    .loadRelationCountAndMap("product.variantCount", "product.variants");

  // Smart search (services/productSearch.ts): every word must match.
  const searching = typeof search === "string" && applySearch(qb, search.slice(0, 200));
  if (categoryId && z.string().uuid().safeParse(categoryId).success) {
    qb.andWhere("product.categoryId = :categoryId", { categoryId });
  }
  if (shopId && z.string().uuid().safeParse(shopId).success) {
    qb.andWhere("product.shopId = :shopId", { shopId });
  }
  const minPrice = priceParam(req.query.minPrice);
  const maxPrice = priceParam(req.query.maxPrice);
  if (minPrice !== null) qb.andWhere("product.price >= :minPrice", { minPrice });
  if (maxPrice !== null) qb.andWhere("product.price <= :maxPrice", { maxPrice });
  if (inStock === "true") qb.andWhere("product.stock > 0");
  if (typeof req.query.ids === "string") {
    const ids = req.query.ids
      .split(",")
      .filter((id) => z.string().uuid().safeParse(id).success)
      .slice(0, 24);
    if (ids.length > 0) qb.andWhere("product.id IN (:...ids)", { ids });
    else qb.andWhere("1 = 0");
  }

  const sortOption: SortOption = isSortOption(sort) ? sort : searching ? "relevance" : "newest";
  switch (sortOption) {
    case "relevance":
      if (searching) orderByRelevance(qb, search);
      else qb.orderBy("product.createdAt", "DESC");
      break;
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
    case "rating_desc":
      qb.orderBy("product.ratingAverage", "DESC")
        .addOrderBy("product.ratingCount", "DESC")
        .addOrderBy("product.createdAt", "DESC");
      break;
    case "newest":
    default:
      qb.orderBy("product.createdAt", "DESC");
      break;
  }

  // limit/offset rather than take/skip: every join here is many-to-one (no
  // duplicated rows), and TypeORM's take/skip can't page by a computed order.
  qb.limit(pageParams.limit).offset(pageParams.skip);

  const [items, total] = await qb.getManyAndCount();
  // No results: offer the closest product name ("Did you mean …?").
  const suggestion = searching && total === 0 ? await suggestionFor(search) : null;
  res.json({ ...paginated(items, total, pageParams), suggestion });
});

function loadProduct(id: string, manager: EntityManager = AppDataSource.manager) {
  return manager.getRepository(Product).findOne({
    where: { id },
    relations: ["category", "shop", "variants"],
    order: { variants: { position: "ASC", name: "ASC" } },
  });
}

router.get("/:id", validateUuidParam(), async (req, res) => {
  const product = await loadProduct(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// "You may also like": in-stock products from the same category first, then
// from the same shop, best rated first.
router.get("/:id/related", validateUuidParam(), async (req, res) => {
  const product = await repo().findOne({
    where: { id: req.params.id },
    select: { id: true, categoryId: true, shopId: true },
  });
  if (!product) return res.status(404).json({ message: "Product not found" });

  const qb = repo()
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.shop", "shop")
    .loadRelationCountAndMap("product.variantCount", "product.variants")
    .where("product.id != :id", { id: product.id })
    .andWhere("product.stock > 0");
  if (product.categoryId) {
    qb.andWhere("(product.categoryId = :categoryId OR product.shopId = :shopId)", {
      categoryId: product.categoryId,
      shopId: product.shopId,
    }).orderBy("CASE WHEN product.categoryId = :categoryId THEN 0 ELSE 1 END", "ASC");
  } else {
    qb.andWhere("product.shopId = :shopId", { shopId: product.shopId });
  }
  qb.addOrderBy("product.ratingAverage", "DESC")
    .addOrderBy("product.createdAt", "DESC")
    // limit (not take): every join here is many-to-one, so rows aren't multiplied.
    .limit(8);

  res.json(await qb.getMany());
});

const variantSchema = z.object({
  id: z.string().uuid().optional(), // an existing option being kept / edited
  name: z.string().trim().min(1).max(60),
  sku: z.string().trim().max(64).nullish(),
  price: z.number().positive().max(1_000_000).nullish(), // null = the product's price
  stock: z.number().int().min(0).max(1_000_000),
});
type VariantInput = z.infer<typeof variantSchema>;

const variantsField = z
  .array(variantSchema)
  .max(50)
  .refine(
    (list) => new Set(list.map((v) => v.name.toLowerCase())).size === list.length,
    { message: "Each option needs a different name" },
  );

const productSchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  price: z.number().positive().max(1_000_000),
  // Ignored when the product has options: its stock is then their total.
  stock: z.number().int().min(0).max(1_000_000),
  imageUrl: imageUrlSchema,
  // Extra gallery photos (in display order).
  galleryUrls: z
    .array(z.string().trim().max(2048).regex(/^https?:\/\/.+/i, "Must be a valid http(s) URL"))
    .max(8)
    .optional(),
  categoryId: z.string().uuid().nullable().optional(), // null clears it
  // Options (size, colour...). On update the list replaces the current one:
  // options left out are deleted, ones with an `id` are edited.
  variants: variantsField.optional(),
});

// Makes the product's options exactly `input` (in that order) and returns the
// product's resulting stock. Must run in a transaction that holds the
// product's lock (lockStock), so no checkout reads half-written options.
async function replaceVariants(
  manager: EntityManager,
  productId: string,
  current: ProductVariant[],
  input: VariantInput[],
): Promise<number> {
  const variantRepo = manager.getRepository(ProductVariant);
  const currentById = new Map(current.map((v) => [v.id, v]));
  for (const v of input) {
    if (v.id && !currentById.has(v.id)) throw new HttpError(400, "Unknown option — reload the page and try again");
  }

  const kept = new Set(input.map((v) => v.id).filter(Boolean));
  const removed = current.filter((v) => !kept.has(v.id));
  if (removed.length > 0) await variantRepo.delete({ id: In(removed.map((v) => v.id)) });

  // Renames can swap names between options ("S"↔"M"); park the renamed ones
  // on a unique placeholder first so the unique (product, name) index holds.
  const renamed = input.filter((v) => v.id && currentById.get(v.id)!.name !== v.name);
  for (const v of renamed) await variantRepo.update(v.id!, { name: `~${v.id}` });

  for (const [position, v] of input.entries()) {
    const fields = {
      name: v.name,
      sku: v.sku || null,
      price: v.price ?? null,
      stock: v.stock,
      position,
    };
    if (v.id) await variantRepo.update(v.id, fields);
    else await variantRepo.insert({ ...fields, productId });
  }
  return input.reduce((sum, v) => sum + v.stock, 0);
}

router.post("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  // A super_admin picks the shop; a shop admin always creates in their own.
  const isSuperAdmin = req.user!.role === "super_admin";
  const parsed = productSchema.extend({ shopId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { shopId: requestedShopId, variants, ...data } = parsed.data;
  if (isSuperAdmin && !requestedShopId)
    return res.status(400).json({ message: "Choose the shop this product belongs to" });
  const shopId = isSuperAdmin ? requestedShopId! : req.shopId!;

  const product = await AppDataSource.transaction(async (manager) => {
    const created = await manager.getRepository(Product).save(
      manager.getRepository(Product).create({ ...data, shopId }),
    );
    if (variants?.length) {
      const stock = await replaceVariants(manager, created.id, [], variants);
      await manager.getRepository(Product).update(created.id, { stock });
    }
    return (await loadProduct(created.id, manager))!;
  });
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

    const { variants, ...data } = parsed.data;
    const product = await AppDataSource.transaction(async (manager) => {
      // Same locks as checkout, so a sale can't land between reading and
      // writing the stock.
      const stock = await lockStock(manager, [req.params.id]);
      const product = stock.products.get(req.params.id);
      if (!product) throw new HttpError(404, "Product not found");
      if (req.user!.role !== "super_admin" && product.shopId !== req.shopId) {
        throw new HttpError(403, "You can only edit products in your own shop");
      }

      Object.assign(product, data);
      if (variants) {
        const total = await replaceVariants(manager, product.id, stock.variantsOf(product.id), variants);
        if (variants.length > 0) product.stock = total;
      } else if (stock.hasVariants(product.id)) {
        // Stock is tracked per option; the total can't be edited directly.
        product.stock = stock.variantsOf(product.id).reduce((sum, v) => sum + v.stock, 0);
      }
      await manager.getRepository(Product).save(product);
      return (await loadProduct(product.id, manager))!;
    });
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

// ---- CSV import -----------------------------------------------------------
// Columns (header row, any order, case-insensitive): name, price (required),
// stock, description, category (a category name), imageUrl. A row whose name
// matches one of the shop's products updates that product's price / stock /
// details; any other row creates a product. All-or-nothing: if any row is
// invalid nothing is saved and every problem is reported with its line number.

const MAX_IMPORT_ROWS = 500;
const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  nom: "name",
  price: "price",
  prix: "price",
  stock: "stock",
  quantity: "stock",
  description: "description",
  category: "category",
  categorie: "category",
  catégorie: "category",
  imageurl: "imageUrl",
  image: "imageUrl",
};

const importSchema = z.object({
  csv: z.string().min(1).max(900_000),
  dryRun: z.boolean().optional(),
  shopId: z.string().uuid().optional(), // super admin only
});

// "1 200,50" (French Excel) and "1200.50" are both 1200.5.
function csvNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  let s = raw.replace(/[\s ]/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

interface ImportRowError {
  line: number;
  message: string;
}

function rowMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ");
}

router.post("/import", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const isSuperAdmin = req.user!.role === "super_admin";
  const shopId = isSuperAdmin ? parsed.data.shopId : req.shopId;
  if (!shopId) return res.status(400).json({ message: "Choose the shop to import into" });
  if (isSuperAdmin && !(await AppDataSource.getRepository(Shop).exists({ where: { id: shopId } }))) {
    return res.status(404).json({ message: "Shop not found" });
  }

  const [header, ...rows] = parseCsv(parsed.data.csv);
  if (!header || rows.length === 0)
    return res.status(400).json({ message: "The file has no products — keep the header row and add one product per line" });
  if (rows.length > MAX_IMPORT_ROWS)
    return res.status(400).json({ message: `Import at most ${MAX_IMPORT_ROWS} products at a time` });

  const columns = header.map((h) => COLUMN_ALIASES[h.trim().toLowerCase().replace(/[\s_-]/g, "")]);
  if (!columns.includes("name") || !columns.includes("price"))
    return res.status(400).json({ message: "The header row needs at least the columns: name, price" });

  const categories = await AppDataSource.getRepository(Category).find({ select: { id: true, name: true } });
  const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const existing = await repo().find({ where: { shopId }, select: { id: true, name: true } });
  const existingByName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const withOptions = new Set(
    (
      await AppDataSource.getRepository(ProductVariant)
        .createQueryBuilder("variant")
        .select('DISTINCT variant."productId"', "productId")
        .innerJoin("variant.product", "product")
        .where("product.shopId = :shopId", { shopId })
        .getRawMany<{ productId: string }>()
    ).map((r) => r.productId),
  );

  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  const toCreate: Partial<Product>[] = [];
  const toUpdate: (Partial<Product> & { id: string })[] = [];

  rows.forEach((cells, index) => {
    const line = index + 2; // 1-based, after the header
    const raw: Record<string, string> = {};
    columns.forEach((column, i) => {
      if (column && cells[i] !== undefined) raw[column] = cells[i].trim();
    });

    let categoryId: string | null | undefined;
    if (raw.category) {
      categoryId = categoryByName.get(raw.category.toLowerCase());
      if (!categoryId) {
        errors.push({ line, message: `Unknown category "${raw.category}"` });
        return;
      }
    }
    const name = (raw.name ?? "").trim();
    const key = name.toLowerCase();
    const existingId = existingByName.get(key);
    const row = productSchema
      .omit({ variants: true, galleryUrls: true })
      .partial({ stock: true })
      .safeParse({
        name,
        price: csvNumber(raw.price),
        stock: csvNumber(raw.stock),
        description: raw.description || undefined,
        imageUrl: raw.imageUrl || undefined,
        categoryId,
      });
    if (!row.success) {
      errors.push({ line, message: rowMessage(row.error) });
      return;
    }
    if (seen.has(key)) {
      errors.push({ line, message: `"${name}" appears more than once in the file` });
      return;
    }
    seen.add(key);
    // Options carry their own stock; it's edited per option in the dashboard.
    if (existingId && withOptions.has(existingId) && row.data.stock !== undefined) {
      errors.push({ line, message: `"${name}" has options — leave its stock empty and update it from the dashboard` });
      return;
    }

    // Empty cells leave an existing product's value alone.
    const fields = Object.fromEntries(
      Object.entries(row.data).filter(([, value]) => value !== undefined),
    ) as Partial<Product>;
    if (existingId) toUpdate.push({ ...fields, id: existingId });
    else toCreate.push({ stock: 0, ...fields, shopId });
  });

  if (errors.length > 0) {
    return res.status(400).json({
      message: `Nothing was imported — fix ${errors.length === 1 ? "this line" : `these ${errors.length} lines`} and try again`,
      errors: errors.slice(0, 50),
    });
  }

  const summary = { created: toCreate.length, updated: toUpdate.length };
  if (parsed.data.dryRun) return res.json({ ...summary, dryRun: true });

  await AppDataSource.transaction(async (manager) => {
    // Same locks as checkout, so a sale can't land between reading and writing stock.
    await lockStock(manager, toUpdate.map((u) => u.id));
    for (const { id, ...fields } of toUpdate) {
      await manager.getRepository(Product).update(id, fields);
    }
    if (toCreate.length > 0) {
      await manager.getRepository(Product).insert(toCreate);
    }
  });
  void audit(req, "product.import", "shop", shopId, summary);
  res.status(201).json(summary);
});

export default router;
