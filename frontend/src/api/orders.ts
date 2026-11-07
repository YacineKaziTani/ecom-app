import { api } from "./client";
import { DeliveryType, Order, OrderStatus, Paginated, PaymentMethod, Shipment } from "./types";

export interface CreateOrderInput {
  paymentMethod: PaymentMethod;
  phone: string;
  wilayaCode: number;
  commune: string;
  deliveryType: DeliveryType;
  shippingAddress: string;
  guestEmail?: string; // required if the caller isn't logged in
  guestName?: string; // used to personalize the confirmation email
  couponCode?: string;
  items: { productId: string; quantity: number }[];
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export interface OrderSummary {
  totalOrders: number;
  pendingOrders: number;
  revenue: number; // paid, non-cancelled orders only
}

export const ordersApi = {
  // Scoped by role on the server: own orders / shop's orders / everything.
  list: (query: OrderListQuery = {}) =>
    api.get<Paginated<Order>>("/orders", { params: query }).then((r) => r.data),
  summary: () => api.get<OrderSummary>("/orders/summary").then((r) => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  // idempotencyKey: pass the SAME key when retrying an identical checkout attempt
  // (network timeout, etc.) so the server returns the existing order instead of
  // creating a duplicate. A fresh key should be used for a genuinely new order.
  create: (data: CreateOrderInput, idempotencyKey: string) =>
    api.post<Order>("/orders", data, { headers: { "Idempotency-Key": idempotencyKey } }).then((r) => r.data),
  // A shop's own part of the order (a super admin may update any shop's).
  updateShipment: (
    orderId: string,
    shopId: string,
    data: { status?: OrderStatus; carrier?: string | null; trackingNumber?: string | null },
  ) =>
    api
      .patch<{ shipment: Shipment; order: Pick<Order, "id" | "status" | "paymentStatus"> }>(
        `/orders/${orderId}/shipments/${shopId}`,
        data,
      )
      .then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then((r) => r.data),
  // Guest order lookup — no auth required, just the order id + the email used at checkout.
  track: (id: string, email: string) =>
    api.get<Order>(`/orders/track/${id}`, { params: { email } }).then((r) => r.data),
};
