import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Category } from "../entities/Category";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { imageUrlSchema, nameSchema, shortTextSchema } from "../utils/validators";

const router = Router();
const repo = () => AppDataSource.getRepository(Category);

router.get("/", async (_req, res) => {
  const categories = await repo().find({ order: { createdAt: "DESC" } });
  res.json(categories);
});

router.get("/:id", validateUuidParam(), async (req, res) => {
  const category = await repo().findOne({ where: { id: req.params.id }, relations: ["products"] });
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json(category);
});

const categorySchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  imageUrl: imageUrlSchema,
});

router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  const category = repo().create(parsed.data);
  await repo().save(category);
  res.status(201).json(category);
});

router.put("/:id", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  const category = await repo().findOne({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ message: "Category not found" });
  Object.assign(category, parsed.data);
  await repo().save(category);
  res.json(category);
});

router.delete("/:id", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const result = await repo().delete(req.params.id);
  if (!result.affected) return res.status(404).json({ message: "Category not found" });
  res.status(204).send();
});

export default router;
