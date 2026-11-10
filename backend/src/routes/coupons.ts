import { Router } from "express";
import { z } from "zod";
import { FindOptionsWhere, In, IsNull } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Coupon } from "../entities/Coupon";
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { previewCoupon } from "../services/coupons";
import { unitPrice } from "../services/inventory";
import { audit } from "../services/audit";

const router = Router();
const repo = () => AppDataSource.getRepository(Coupon);

router.get("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const where: FindOptionsWhere<Coupon> = {};
  if (req.user!.role === "super_admin") {
    const { shopId, global } = req.query;
    if (typeof shopId === "string") {
      if (!z.string().uuid().safeParse(shopId).success)
        return res.status(400).json({ message: "Invalid shopId" });
      where.shopId = shopId;
    } else if (global === "true") {
      // A plain `null` is silently ignored by TypeORM's find — IsNull() is required.
      where.shopId = IsNull();
    }
  } else {
    where.shopId = req.shopId;
  }
  const coupons = await repo().find({ where, order: { createdAt: "DESC" } });
  res.json(coupons);
});

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Letters, numbers, hyphens and underscores only",
    ),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

function percentageTooHigh(type: Coupon["type"], value: number) {
  return type === "percentage" && value > 100;
}

async function codeTaken(code: string) {
  return (await repo().count({ where: { code } })) > 0;
}

router.post("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  // Only a super_admin may pick the shop (or leave it empty for a platform-wide
  // coupon); a shop admin's coupons are always locked to their own shop.
  const isSuperAdmin = req.user!.role === "super_admin";
  const schema = couponSchema.extend({
    shopId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { shopId: requestedShopId, expiresAt, ...data } = parsed.data;
  if (percentageTooHigh(data.type, data.value)) {
    return res
      .status(400)
      .json({ message: "Percentage discounts can't exceed 100" });
  }

  const code = data.code.toUpperCase();
  if (await codeTaken(code))
    return res
      .status(409)
      .json({ message: "A coupon with this code already exists" });

  const coupon = repo().create({
    ...data,
    code,
    shopId: isSuperAdmin ? requestedShopId : req.shopId,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });
  await repo().save(coupon);
  void audit(req, "coupon.create", "coupon", coupon.id, { code: coupon.code, type: coupon.type, value: coupon.value });
  res.status(201).json(coupon);
});

router.put(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const parsed = couponSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.flatten() });

    const coupon = await repo().findOne({ where: { id: req.params.id } });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    if (req.user!.role !== "super_admin" && coupon.shopId !== req.shopId) {
      return res
        .status(403)
        .json({ message: "You can only edit your own shop's coupons" });
    }

    const { code, expiresAt, ...rest } = parsed.data;

    if (code) {
      const newCode = code.toUpperCase();
      if (newCode !== coupon.code) {
        if (await codeTaken(newCode))
          return res
            .status(409)
            .json({ message: "A coupon with this code already exists" });
        coupon.code = newCode;
      }
    }
    if (expiresAt) coupon.expiresAt = new Date(expiresAt);
    Object.assign(coupon, rest);

    if (percentageTooHigh(coupon.type, Number(coupon.value))) {
      return res
        .status(400)
        .json({ message: "Percentage discounts can't exceed 100" });
    }

    await repo().save(coupon);
    void audit(req, "coupon.update", "coupon", coupon.id, { code: coupon.code, changes: parsed.data });
    res.json(coupon);
  },
);

router.delete(
  "/:id",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const coupon = await repo().findOne({ where: { id: req.params.id } });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    if (req.user!.role !== "super_admin" && coupon.shopId !== req.shopId) {
      return res
        .status(403)
        .json({ message: "You can only delete your own shop's coupons" });
    }

    await repo().delete(coupon.id);
    void audit(req, "coupon.delete", "coupon", coupon.id, { code: coupon.code });
    res.status(204).send();
  },
);

const previewSchema = z.object({
  code: z.string().trim().min(1).max(30),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullish(),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1)
    .max(50),
});

// Public: preview a coupon against the current cart before checkout. The
// subtotal is recomputed from live prices, never trusted from the client.
router.post("/validate", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const { items } = parsed.data;
  const variantIds = items.map((i) => i.variantId).filter((id): id is string => !!id);
  const [products, variants] = await Promise.all([
    AppDataSource.getRepository(Product).findBy({ id: In(items.map((i) => i.productId)) }),
    variantIds.length
      ? AppDataSource.getRepository(ProductVariant).findBy({ id: In(variantIds) })
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let subtotal = 0;
  const shopIds: string[] = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    if (!product || (item.variantId && variant?.productId !== product.id))
      return res
        .status(400)
        .json({ message: "One or more items in your cart no longer exist" });
    subtotal += unitPrice(product, variant) * item.quantity;
    shopIds.push(product.shopId);
  }

  // A CouponError (invalid / expired / used up) becomes a 400 via the global error handler.
  const { coupon, discountAmount } = await previewCoupon(
    AppDataSource.manager,
    parsed.data.code,
    subtotal,
    shopIds,
  );
  res.json({
    code: coupon.code,
    type: coupon.type,
    value: Number(coupon.value),
    subtotal,
    discountAmount,
    newTotal: subtotal - discountAmount,
  });
});

export default router;
