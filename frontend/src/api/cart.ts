import { api } from "./client";
import { Product } from "./types";

export interface CartLine {
  productId: string;
  quantity: number;
  product: Product;
}

export interface CartResponse {
  lines: CartLine[];
}

export const cartApi = {
  get: () => api.get<CartResponse>("/cart").then((r) => r.data),

  addItem: (productId: string, quantity = 1) =>
    api
      .post<CartResponse>("/cart", { productId, quantity })
      .then((r) => r.data),

  setQuantity: (productId: string, quantity: number) =>
    api
      .patch<CartResponse>(`/cart/${productId}`, { quantity })
      .then((r) => r.data),

  removeItem: (productId: string) =>
    api.delete<CartResponse>(`/cart/${productId}`).then((r) => r.data),

  clear: () => api.delete<CartResponse>("/cart").then((r) => r.data),

  merge: (items: { productId: string; quantity: number }[]) =>
    api.post<CartResponse>("/cart/merge", { items }).then((r) => r.data),
};
