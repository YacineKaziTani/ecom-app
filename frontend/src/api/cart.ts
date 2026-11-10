import { api } from "./client";
import { Product, ProductVariant } from "./types";

export interface ServerCartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  product: Product;
  variant: ProductVariant | null;
}

export interface CartResponse {
  lines: ServerCartLine[];
}

export interface CartItemRef {
  productId: string;
  variantId?: string | null;
}

const lineParams = (variantId?: string | null) => (variantId ? { params: { variantId } } : undefined);

export const cartApi = {
  get: () => api.get<CartResponse>("/cart").then((r) => r.data),

  addItem: (productId: string, quantity = 1, variantId?: string | null) =>
    api.post<CartResponse>("/cart", { productId, variantId, quantity }).then((r) => r.data),

  setQuantity: ({ productId, variantId }: CartItemRef, quantity: number) =>
    api.patch<CartResponse>(`/cart/${productId}`, { quantity }, lineParams(variantId)).then((r) => r.data),

  removeItem: ({ productId, variantId }: CartItemRef) =>
    api.delete<CartResponse>(`/cart/${productId}`, lineParams(variantId)).then((r) => r.data),

  clear: () => api.delete<CartResponse>("/cart").then((r) => r.data),

  merge: (items: (CartItemRef & { quantity: number })[]) =>
    api.post<CartResponse>("/cart/merge", { items }).then((r) => r.data),
};
