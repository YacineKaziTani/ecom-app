import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { CartItem } from "../entities/Cartitem";
import { Product } from "../entities/Product";
import { requireAuth } from "../middleware/auth";

const router = Router();
const cartRepo = () => AppDataSource.getRepository(CartItem);
const productRepo = () => AppDataSource.getRepository(Product);

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

router.get("/", async (req, res) => {
  const lines = await serializeCart(req.user!.id);
  res.json({ lines });
});

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
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

  const repo = cartRepo();
  const existing = await repo.findOne({
    where: { userId: req.user!.id, productId },
  });

  if (existing) {
    existing.quantity += quantity;
    await repo.save(existing);
  } else {
    await repo.save(repo.create({ userId: req.user!.id, productId, quantity }));
  }

  const lines = await serializeCart(req.user!.id);
  res.status(201).json({ lines });
});

const mergeSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(999),
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

  const repo = cartRepo();
  const userId = req.user!.id;

  for (const { productId, quantity } of parsed.data.items) {
    const product = await productRepo().findOne({ where: { id: productId } });
    if (!product) continue; // silently skip products that no longer exist

    const existing = await repo.findOne({ where: { userId, productId } });
    if (existing) {
      existing.quantity += quantity;
      await repo.save(existing);
    } else {
      await repo.save(repo.create({ userId, productId, quantity }));
    }
  }

  const lines = await serializeCart(userId);
  res.json({ lines });
});

const quantitySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
});

router.patch("/:productId", async (req, res) => {
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

router.delete("/:productId", async (req, res) => {
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
