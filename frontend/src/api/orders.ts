import { api } from "./client";
import { Order, OrderStatus } from "./types";

export interface CreateOrderInput {
  shippingAddress: string;
  guestEmail?: string; // required if the caller isn't logged in
  guestName?: string; // used to personalize the confirmation email
  couponCode?: string;
  items: { productId: string; quantity: number }[];
}

export const ordersApi = {
  list: () => api.get<Order[]>("/orders").then((r) => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  // idempotencyKey: pass the SAME key when retrying an identical checkout attempt
  // (network timeout, etc.) so the server returns the existing order instead of
  // creating a duplicate. A fresh key should be used for a genuinely new order.
  create: (data: CreateOrderInput, idempotencyKey: string) =>
    api.post<Order>("/orders", data, { headers: { "Idempotency-Key": idempotencyKey } }).then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then((r) => r.data),
  // Guest order lookup — no auth required, just the order id + the email used at checkout.
  track: (id: string, email: string) =>
    api.get<Order>(`/orders/track/${id}`, { params: { email } }).then((r) => r.data),
};
