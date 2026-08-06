import { EntityManager } from "typeorm";
import { Coupon } from "../entities/Coupon";

export class CouponError extends Error {}

export interface CouponResult {
  coupon: Coupon;
  discountAmount: number;
}

function computeDiscount(
  coupon: Coupon,
  subtotal: number,
  itemShopIds: string[],
): number {
  if (!coupon.isActive)
    throw new CouponError("This coupon is no longer active");
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    throw new CouponError("This coupon has expired");
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new CouponError("This coupon has reached its usage limit");
  }
  if (
    coupon.minOrderAmount != null &&
    subtotal < Number(coupon.minOrderAmount)
  ) {
    throw new CouponError(
      `This coupon requires a minimum order of $${Number(coupon.minOrderAmount).toFixed(2)}`,
    );
  }
  if (coupon.shopId) {
    const allFromShop =
      itemShopIds.length > 0 && itemShopIds.every((id) => id === coupon.shopId);
    if (!allFromShop) {
      throw new CouponError(
        "This coupon only applies to orders made up entirely of items from that shop",
      );
    }
  }

  const rawDiscount =
    coupon.type === "percentage"
      ? (subtotal * Number(coupon.value)) / 100
      : Number(coupon.value);
  return Math.min(Math.round(rawDiscount * 100) / 100, subtotal);
}

export async function previewCoupon(
  manager: EntityManager,
  rawCode: string,
  subtotal: number,
  itemShopIds: string[],
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await manager
    .getRepository(Coupon)
    .findOne({ where: { code } });
  if (!coupon) throw new CouponError("Invalid coupon code");
  const discountAmount = computeDiscount(coupon, subtotal, itemShopIds);
  return { coupon, discountAmount };
}

export async function applyCouponWithLock(
  manager: EntityManager,
  rawCode: string,
  subtotal: number,
  itemShopIds: string[],
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await manager
    .createQueryBuilder(Coupon, "coupon")
    .where("coupon.code = :code", { code })
    .setLock("pessimistic_write")
    .getOne();

  if (!coupon) throw new CouponError("Invalid coupon code");
  const discountAmount = computeDiscount(coupon, subtotal, itemShopIds);

  coupon.usedCount += 1;
  await manager.getRepository(Coupon).save(coupon);

  return { coupon, discountAmount };
}
