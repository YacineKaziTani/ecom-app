import { api } from "./client";
import { Coupon, CouponType } from "./types";

export interface CouponInput {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  expiresAt?: string; // ISO datetime
  isActive?: boolean;
}

export interface CouponPreview {
  code: string;
  type: CouponType;
  value: number;
  subtotal: number;
  discountAmount: number;
  newTotal: number;
}

export const couponsApi = {
  list: (params?: { shopId?: string; global?: boolean }) =>
    api.get<Coupon[]>("/coupons", { params }).then((r) => r.data),
  create: (data: CouponInput) => api.post<Coupon>("/coupons", data).then((r) => r.data),
  update: (id: string, data: Partial<CouponInput>) => api.put<Coupon>(`/coupons/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/coupons/${id}`).then((r) => r.data),
  // Public: preview a coupon against the current cart before checkout.
  validate: (code: string, items: { productId: string; quantity: number }[]) =>
    api.post<CouponPreview>("/coupons/validate", { code, items }).then((r) => r.data),
};
