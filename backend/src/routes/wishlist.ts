import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { WishlistItem } from "../entities/WishlistItem";
import { requireAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";

const router = Router();
const repo = () => AppDataSource.getRepository(WishlistItem);

router.use(requireAuth);

router.get("/", async (req, res) => {
  const items = await repo().find({
    where: { userId: req.user!.id },
    relations: ["product", "product.shop", "product.category"],
    order: { createdAt: "DESC" },
  });
  res.json(items);
});

router.post("/", async (req, res) => {
  const parsed = z.object({ productId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
  const { productId } = parsed.data;
  if (!(await AppDataSource.getRepository(Product).exist({ where: { id: productId } })))
    return res.status(404).json({ message: "Product not found" });

  // Saving twice is fine — it's already there.
  await repo()
    .createQueryBuilder()
    .insert()
    .values({ userId: req.user!.id, productId })
    .orIgnore()
    .execute();
  res.status(201).json({ productId });
});

router.delete("/:productId", validateUuidParam("productId"), async (req, res) => {
  await repo().delete({ userId: req.user!.id, productId: req.params.productId });
  res.status(204).send();
});

export default router;
