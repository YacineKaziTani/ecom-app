import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Shop } from "../entities/Shop";
import {
  requireAuth,
  requireAnyAdmin,
  requireSuperAdmin,
} from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { slugify } from "../utils/slug";
import { audit } from "../services/audit";
import {
  httpsUrlSchema,
  imageUrlSchema,
  nameSchema,
  shortTextSchema,
} from "../utils/validators";

const router = Router();
const repo = () => AppDataSource.getRepository(Shop);


router.get("/", async (_req, res) => {
  const shops = await repo().find({ order: { createdAt: "DESC" } });
  res.json(shops);
});

router.get("/:id", validateUuidParam(), async (req, res) => {
  const shop = await repo().findOne({
    where: { id: req.params.id },
    relations: ["products"],
  });
  if (!shop) return res.status(404).json({ message: "Shop not found" });
  res.json(shop);
});

const slugParamSchema = z.string().regex(/^[a-z0-9-]{1,150}$/);

router.get("/slug/:slug", async (req, res) => {
  if (!slugParamSchema.safeParse(req.params.slug).success) {
    return res.status(404).json({ message: "Shop not found" });
  }
  const shop = await repo().findOne({ where: { slug: req.params.slug } });
  if (!shop) return res.status(404).json({ message: "Shop not found" });
  // For the shop page header: how many products, and their overall rating.
  const [stats] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS "productCount",
            COALESCE(SUM("ratingCount"), 0)::int AS "ratingCount",
            CASE WHEN SUM("ratingCount") > 0
                 THEN ROUND(SUM("ratingAverage" * "ratingCount") / SUM("ratingCount"), 2)::float
                 ELSE 0 END AS "ratingAverage"
     FROM products WHERE "shopId" = $1`,
    [shop.id],
  );
  res.json({ ...shop, stats });
});

// Admin: get MY shop
router.get("/me/mine", requireAuth, requireAnyAdmin, async (req, res) => {
  const shop = await repo().findOne({ where: { ownerId: req.user!.id } });
  if (!shop)
    return res.status(404).json({ message: "You don't have a shop yet" });
  res.json(shop);
});

const shopSchema = z.object({
  name: nameSchema,
  description: shortTextSchema,
  logoUrl: imageUrlSchema,
  // Shop page profile.
  coverUrl: imageUrlSchema,
  story: z
    .string()
    .trim()
    .max(3000)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  wilayaCode: z.number().int().min(1).max(58).nullable().optional(),
  instagramUrl: httpsUrlSchema.optional(),
  facebookUrl: httpsUrlSchema.optional(),
  tiktokUrl: httpsUrlSchema.optional(),
});

router.post("/", requireAuth, requireAnyAdmin, async (req, res) => {
  // A super_admin creates a shop on behalf of an owner; an admin creates their own.
  const isSuperAdmin = req.user!.role === "super_admin";
  const parsed = shopSchema.extend({ ownerId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  if (isSuperAdmin && !parsed.data.ownerId)
    return res.status(400).json({ message: "Choose the shop owner" });
  const ownerId = isSuperAdmin ? parsed.data.ownerId! : req.user!.id;

  const existing = await repo().findOne({ where: { ownerId } });
  if (existing)
    return res.status(409).json({ message: "This user already owns a shop" });

  const slug = slugify(parsed.data.name);
  if (!slug)
    return res
      .status(400)
      .json({
        message: "Shop name must include at least one letter or number",
      });

  const slugTaken = await repo().findOne({ where: { slug } });
  if (slugTaken)
    return res
      .status(409)
      .json({
        message:
          "A shop with a very similar name already exists — try a more distinct name",
      });

  const shop = repo().create({
    name: parsed.data.name,
    description: parsed.data.description,
    logoUrl: parsed.data.logoUrl,
    coverUrl: parsed.data.coverUrl,
    story: parsed.data.story,
    wilayaCode: parsed.data.wilayaCode,
    instagramUrl: parsed.data.instagramUrl,
    facebookUrl: parsed.data.facebookUrl,
    tiktokUrl: parsed.data.tiktokUrl,
    slug,
    ownerId,
  });
  await repo().save(shop);
  res.status(201).json(shop);
});

router.put(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  async (req, res) => {
    const parsed = shopSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.flatten() });

    const shop = await repo().findOne({ where: { id: req.params.id } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (req.user!.role !== "super_admin" && shop.ownerId !== req.user!.id) {
      return res
        .status(403)
        .json({ message: "You can only edit your own shop" });
    }

    Object.assign(shop, parsed.data);

    if (parsed.data.name) {
      const newSlug = slugify(parsed.data.name);
      if (!newSlug)
        return res
          .status(400)
          .json({
            message: "Shop name must include at least one letter or number",
          });
      if (newSlug !== shop.slug) {
        const slugTaken = await repo().findOne({ where: { slug: newSlug } });
        if (slugTaken)
          return res
            .status(409)
            .json({
              message:
                "A shop with a very similar name already exists — try a more distinct name",
            });
        shop.slug = newSlug;
      }
    }

    await repo().save(shop);
    res.json(shop);
  },
);

router.delete(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const result = await repo().delete(req.params.id);
    if (!result.affected)
      return res.status(404).json({ message: "Shop not found" });
    void audit(req, "shop.delete", "shop", req.params.id);
    res.status(204).send();
  },
);

export default router;
