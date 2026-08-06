import { Router } from "express";
import { z } from "zod";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Coupon } from "../entities/Coupon";
import { Product } from "../entities/Product";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { previewCoupon, CouponError } from "../services/coupons";

const router = Router();
const repo = () => AppDataSource.getRepository(Coupon);

// Admin: list coupons. A shop-admin only sees their own; super_admin sees all
// (or filter to one shop with ?shopId=, or ?global=true for platform-wide ones).
router.get("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const where: any = {};
  if (req.user!.role === "super_admin") {
    if (req.query.shopId) where.shopId = req.query.shopId as string;
    else if (req.query.global === "true") where.shopId = null as any;
  } else {
    where.shopId = req.shopId;
  }
  const coupons = await repo().find({ where, order: { createdAt: "DESC" } });
  res.json(coupons);
});

const couponSchema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

router.post("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  if (parsed.data.type === "percentage" && parsed.data.value > 100) {
    return res.status(400).json({ message: "Percentage discounts can't exceed 100" });
  }

  const code = parsed.data.code.toUpperCase();
  const existing = await repo().findOne({ where: { code } });
  if (existing) return res.status(409).json({ message: "A coupon with this code already exists" });

  // Shop-admins can only create coupons scoped to their own shop. Super_admin
  // creates a platform-wide coupon (shopId omitted) unless they explicitly
  // pass a shopId in the body.
  const shopId = req.user!.role === "super_admin" ? (req.body.shopId as string | undefined) : req.shopId;

  const coupon = repo().create({
    ...parsed.data,
    code,
    shopId,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  });
  await repo().save(coupon);
  res.status(201).json(coupon);
});

router.put("/:id", validateUuidParam(), requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const parsed = couponSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const coupon = await repo().findOne({ where: { id: req.params.id } });
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  if (req.user!.role !== "super_admin" && coupon.shopId !== req.shopId) {
    return res.status(403).json({ message: "You can only edit your own shop's coupons" });
  }

  if (parsed.data.code) {
    const newCode = parsed.data.code.toUpperCase();
    if (newCode !== coupon.code) {
      const existing = await repo().findOne({ where: { code: newCode } });
      if (existing) return res.status(409).json({ message: "A coupon with this code already exists" });
      coupon.code = newCode;
    }
  }

  Object.assign(coupon, {
    ...parsed.data,
    code: undefined, // already handled above
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : coupon.expiresAt,
  });
  await repo().save(coupon);
  res.json(coupon);
});

router.delete("/:id", validateUuidParam(), requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const coupon = await repo().findOne({ where: { id: req.params.id } });
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  if (req.user!.role !== "super_admin" && coupon.shopId !== req.shopId) {
    return res.status(403).json({ message: "You can only delete your own shop's coupons" });
  }

  await repo().delete(coupon.id);
  res.status(204).send();
});

// Public: preview a coupon against the current cart before checkout. Recomputes
// the subtotal server-side from live product prices — never trusts a
// client-supplied amount.
const previewSchema = z.object({
  code: z.string().trim().min(1).max(30),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

router.post("/validate", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const productRepo = AppDataSource.getRepository(Product);
  const products = await productRepo.findBy({ id: In(parsed.data.items.map((i) => i.productId)) });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const shopIds: string[] = [];
  for (const item of parsed.data.items) {
    const product = productMap.get(item.productId);
    if (!product) return res.status(400).json({ message: "One or more items in your cart no longer exist" });
    subtotal += Number(product.price) * item.quantity;
    shopIds.push(product.shopId);
  }

  try {
    const { coupon, discountAmount } = await previewCoupon(AppDataSource.manager, parsed.data.code, subtotal, shopIds);
    res.json({
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      subtotal,
      discountAmount,
      newTotal: subtotal - discountAmount,
    });
  } catch (err) {
    if (err instanceof CouponError) return res.status(400).json({ message: err.message });
    console.error("Coupon validation failed:", err);
    res.status(500).json({ message: "Could not validate coupon" });
  }
});

export default router;
