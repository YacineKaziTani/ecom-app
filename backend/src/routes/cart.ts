import { Router } from "express";
import { z } from "zod";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { CartItem } from "../entities/CartItem";
import { Product } from "../entities/Product";
import { requireAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";

const router = Router();
const cartRepo = () => AppDataSource.getRepository(CartItem);
const productRepo = () => AppDataSource.getRepository(Product);

const MAX_QUANTITY = 999;

router.use(requireAuth);

async function serializeCart(userId: string) {
  const items = await cartRepo().find({
    where: { userId },
    relations: { product: true },
    order: { createdAt: "ASC" },
  });
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    product: item.product,
  }));
}

// Adds `quantity` to the user's line for a product, creating it if needed.
async function addToCart(userId: string, productId: string, quantity: number) {
  const repo = cartRepo();
  const existing = await repo.findOne({ where: { userId, productId } });
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
    await repo.save(existing);
  } else {
    await repo.save(repo.create({ userId, productId, quantity }));
  }
}

router.get("/", async (req, res) => {
  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

const quantityField = z.coerce.number().int().min(1).max(MAX_QUANTITY);

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantityField.default(1),
});

router.post("/", async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { productId, quantity } = parsed.data;
  const product = await productRepo().findOne({ where: { id: productId } });
  if (!product) return res.status(404).json({ message: "Product not found" });

  await addToCart(req.user!.id, productId, quantity);

  const lines = await serializeCart(req.user!.id);
  res.status(201).json({ lines });
});

const mergeSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: quantityField }))
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

  // Silently skip products that no longer exist.
  const existingProducts = await productRepo().find({
    where: { id: In(items.map((i) => i.productId)) },
    select: { id: true },
  });
  const existingIds = new Set(existingProducts.map((p) => p.id));

  for (const { productId, quantity } of items) {
    if (existingIds.has(productId)) await addToCart(userId, productId, quantity);
  }

  const lines = await serializeCart(userId);
  res.json({ lines });
});

const quantitySchema = z.object({ quantity: quantityField });

router.patch("/:productId", validateUuidParam("productId"), async (req, res) => {
  const parsed = quantitySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const repo = cartRepo();
  const item = await repo.findOne({
    where: { userId: req.user!.id, productId: req.params.productId },
  });
  if (!item) return res.status(404).json({ message: "Item not in cart" });

  item.quantity = parsed.data.quantity;
  await repo.save(item);

  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

router.delete("/:productId", validateUuidParam("productId"), async (req, res) => {
  await cartRepo().delete({
    userId: req.user!.id,
    productId: req.params.productId,
  });
  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

router.delete("/", async (req, res) => {
  await cartRepo().delete({ userId: req.user!.id });
  res.json({ lines: [] });
});

export default router;
