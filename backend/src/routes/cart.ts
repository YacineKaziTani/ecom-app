import { Router } from "express";
import { z } from "zod";
import { In, IsNull } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { CartItem } from "../entities/CartItem";
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { requireAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { HttpError } from "../utils/httpError";
import { mergeLines, StockLine } from "../services/inventory";

// A cart line is a product, plus the option chosen when the product has
// options (size, colour...). Lines are addressed as /:productId, with
// ?variantId= for an option.

const router = Router();
const cartRepo = () => AppDataSource.getRepository(CartItem);

const MAX_QUANTITY = 999;

router.use(requireAuth);

async function serializeCart(userId: string) {
  const items = await cartRepo().find({
    where: { userId },
    relations: { product: true, variant: true },
    order: { createdAt: "ASC" },
  });
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    product: item.product,
    variant: item.variant ?? null,
  }));
}

// Adds each line's `quantity` to the user's matching line, creating it if
// needed. One statement for all lines, so two concurrent adds can't both
// insert (the unique line index catches it). Repeated lines are merged first:
// one INSERT ... ON CONFLICT can't update the same row twice. New lines get
// createdAt a microsecond apart, in the order given, so the cart (listed by
// createdAt) keeps the guest's order after a merge.
async function addToCart(userId: string, lines: StockLine[]) {
  const merged = mergeLines(lines);
  if (merged.length === 0) return;
  await AppDataSource.query(
    `INSERT INTO cart_items ("userId", "productId", "variantId", quantity, "createdAt")
     SELECT $1::uuid, l."productId", l."variantId", LEAST(l.quantity, ${MAX_QUANTITY}),
            now() + l.n * interval '1 microsecond'
     FROM unnest($2::uuid[], $3::uuid[], $4::int[]) WITH ORDINALITY AS l("productId", "variantId", quantity, n)
     ON CONFLICT ("userId", "productId", "variantId") DO UPDATE
       SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, ${MAX_QUANTITY}),
           "updatedAt" = now()`,
    [
      userId,
      merged.map((l) => l.productId),
      merged.map((l) => l.variantId ?? null),
      merged.map((l) => l.quantity),
    ],
  );
}

// The product must exist, and an option must be picked exactly when the
// product has some.
async function assertLine(productId: string, variantId: string | null) {
  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new HttpError(404, "Product not found");
  const variants = await AppDataSource.getRepository(ProductVariant).find({
    where: { productId },
    select: { id: true },
  });
  if (variantId) {
    if (!variants.some((v) => v.id === variantId)) throw new HttpError(404, "Option not found");
  } else if (variants.length > 0) {
    throw new HttpError(400, "Choose an option first", { code: "VARIANT_REQUIRED" });
  }
}

router.get("/", async (req, res) => {
  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

const quantityField = z.coerce.number().int().min(1).max(MAX_QUANTITY);
const variantIdField = z.string().uuid().nullish();

const addItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: variantIdField,
  quantity: quantityField.default(1),
});

router.post("/", async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { productId, quantity } = parsed.data;
  const variantId = parsed.data.variantId ?? null;
  await assertLine(productId, variantId);
  await addToCart(req.user!.id, [{ productId, variantId, quantity }]);

  const lines = await serializeCart(req.user!.id);
  res.status(201).json({ lines });
});

const mergeSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: variantIdField,
        quantity: quantityField,
      }),
    )
    .max(200),
});

// Called right after login: folds a guest's localStorage cart into their
// server-side cart, summing quantities with whatever's already saved there.
router.post("/merge", async (req, res) => {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const userId = req.user!.id;
  const { items } = parsed.data;
  const productIds = [...new Set(items.map((i) => i.productId))];

  // Silently skip lines that can't be bought any more: deleted products or
  // options, or a product that has gained options since it was added.
  const [products, variants] = productIds.length
    ? await Promise.all([
        AppDataSource.getRepository(Product).find({
          where: { id: In(productIds) },
          select: { id: true },
        }),
        AppDataSource.getRepository(ProductVariant).find({
          where: { productId: In(productIds) },
          select: { id: true, productId: true },
        }),
      ])
    : [[], []];
  const existingIds = new Set(products.map((p) => p.id));
  const variantOwner = new Map(variants.map((v) => [v.id, v.productId]));
  const withVariants = new Set(variants.map((v) => v.productId));

  await addToCart(
    userId,
    items.filter(({ productId, variantId }) =>
      existingIds.has(productId) &&
      (variantId ? variantOwner.get(variantId) === productId : !withVariants.has(productId)),
    ),
  );

  const lines = await serializeCart(userId);
  res.json({ lines });
});

const quantitySchema = z.object({ quantity: quantityField });

function lineWhere(userId: string, productId: string, rawVariantId: unknown) {
  const parsed = z.string().uuid().optional().safeParse(rawVariantId || undefined);
  if (!parsed.success) throw new HttpError(400, "Invalid variantId");
  return { userId, productId, variantId: parsed.data ?? IsNull() };
}

router.patch("/:productId", validateUuidParam("productId"), async (req, res) => {
  const parsed = quantitySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const repo = cartRepo();
  const item = await repo.findOne({
    where: lineWhere(req.user!.id, req.params.productId, req.query.variantId),
  });
  if (!item) return res.status(404).json({ message: "Item not in cart" });

  item.quantity = parsed.data.quantity;
  await repo.save(item);

  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

router.delete("/:productId", validateUuidParam("productId"), async (req, res) => {
  await cartRepo().delete(lineWhere(req.user!.id, req.params.productId, req.query.variantId));
  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

router.delete("/", async (req, res) => {
  await cartRepo().delete({ userId: req.user!.id });
  res.json({ lines: [] });
});

export default router;
