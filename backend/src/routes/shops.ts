import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Shop } from "../entities/Shop";
import { requireAuth, requireAnyAdmin, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { imageUrlSchema, nameSchema, shortTextSchema } from "../utils/validators";

const router = Router();
const repo = () => AppDataSource.getRepository(Shop);

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Public: browse shops (storefront could list "sold by X" pages)
router.get("/", async (_req, res) => {
  const shops = await repo().find({ order: { createdAt: "DESC" } });
  res.json(shops);
});

router.get("/:id", validateUuidParam(), async (req, res) => {
  const shop = await repo().findOne({ where: { id: req.params.id }, relations: ["products"] });
  if (!shop) return res.status(404).json({ message: "Shop not found" });
  res.json(shop);
});

const slugParamSchema = z.string().regex(/^[a-z0-9-]{1,150}$/);

// Public: look up a shop by its slug (used for pretty /shops/:slug storefront URLs)
router.get("/slug/:slug", async (req, res) => {
  if (!slugParamSchema.safeParse(req.params.slug).success) {
    return res.status(404).json({ message: "Shop not found" });
  }
  const shop = await repo().findOne({ where: { slug: req.params.slug } });
  if (!shop) return res.status(404).json({ message: "Shop not found" });
  res.json(shop);
});

// Admin: get MY shop (or super_admin can pass ?ownerId=)
router.get("/me/mine", requireAuth, requireAnyAdmin, async (req, res) => {
  const shop = await repo().findOne({ where: { ownerId: req.user!.id } });
  if (!shop) return res.status(404).json({ message: "You don't have a shop yet" });
  res.json(shop);
});

const shopSchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  logoUrl: imageUrlSchema,
});

// Admin creates their OWN shop (one per admin). Super_admin can create one for any ownerId.
router.post("/", requireAuth, requireAnyAdmin, async (req, res) => {
  const schema = req.user!.role === "super_admin" ? shopSchema.extend({ ownerId: z.string().uuid() }) : shopSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const ownerId = req.user!.role === "super_admin" ? (parsed.data as any).ownerId : req.user!.id;

  const existing = await repo().findOne({ where: { ownerId } });
  if (existing) return res.status(409).json({ message: "This user already owns a shop" });

  const slug = slugify(parsed.data.name);
  if (!slug) return res.status(400).json({ message: "Shop name must include at least one letter or number" });

  const slugTaken = await repo().findOne({ where: { slug } });
  if (slugTaken) return res.status(409).json({ message: "A shop with a very similar name already exists — try a more distinct name" });

  const shop = repo().create({
    name: parsed.data.name,
    description: parsed.data.description,
    logoUrl: parsed.data.logoUrl,
    slug,
    ownerId,
  });
  await repo().save(shop);
  res.status(201).json(shop);
});

router.put("/:id", validateUuidParam(), requireAuth, requireAnyAdmin, async (req, res) => {
  const parsed = shopSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const shop = await repo().findOne({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ message: "Shop not found" });

  if (req.user!.role !== "super_admin" && shop.ownerId !== req.user!.id) {
    return res.status(403).json({ message: "You can only edit your own shop" });
  }

  Object.assign(shop, parsed.data);

  if (parsed.data.name) {
    const newSlug = slugify(parsed.data.name);
    if (!newSlug) return res.status(400).json({ message: "Shop name must include at least one letter or number" });
    if (newSlug !== shop.slug) {
      const slugTaken = await repo().findOne({ where: { slug: newSlug } });
      if (slugTaken) return res.status(409).json({ message: "A shop with a very similar name already exists — try a more distinct name" });
      shop.slug = newSlug;
    }
  }

  await repo().save(shop);
  res.json(shop);
});

// Only super_admin can delete shops outright
router.delete("/:id", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const result = await repo().delete(req.params.id);
  if (!result.affected) return res.status(404).json({ message: "Shop not found" });
  res.status(204).send();
});

export default router;
