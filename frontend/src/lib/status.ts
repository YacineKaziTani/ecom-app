import { Order, OrderStatus, PaymentStatus, UserRole } from "../api/types";
import type { MessageKey } from "../i18n/messages";

/**
 * One place that maps a domain status to a badge class, so the same status
 * never renders two different colours across the app — and every colour comes
 * from a theme token, which keeps dark mode correct for free.
 */
export const orderStatusBadge: Record<OrderStatus, string> = {
  pending: "badge-warning",
  processing: "badge-info",
  shipped: "badge-accent",
  delivered: "badge-success",
  cancelled: "badge-danger",
  returned: "badge-neutral",
};

export const riskBadge: Record<"low" | "medium" | "high" | "blocked", string> = {
  low: "badge-success",
  medium: "badge-warning",
  high: "badge-danger",
  blocked: "badge-danger",
};

export const paymentStatusBadge: Record<PaymentStatus, string> = {
  unpaid: "badge-neutral",
  paid: "badge-success",
  failed: "badge-danger",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
};

// Payment state as the customer/admin should read it: an unpaid
// pay-on-delivery order isn't "pending payment", it's paid at the door.
export function paymentLabel(order: Pick<Order, "paymentMethod" | "paymentStatus">): string {
  if (order.paymentMethod === "cod") {
    return order.paymentStatus === "paid" ? "Paid on delivery" : "Pay on delivery";
  }
  return paymentStatusLabel[order.paymentStatus];
}

// Translation key for the storefront (the dashboard uses paymentLabel).
export function paymentLabelKey(order: Pick<Order, "paymentMethod" | "paymentStatus">): MessageKey {
  if (order.paymentMethod === "cod") {
    return order.paymentStatus === "paid" ? "payment.codPaid" : "payment.codUnpaid";
  }
  return `payment.${order.paymentStatus}`;
}

export function paymentBadge(order: Pick<Order, "paymentMethod" | "paymentStatus">): string {
  if (order.paymentMethod === "cod" && order.paymentStatus === "unpaid") return "badge-info";
  return paymentStatusBadge[order.paymentStatus];
}

// "Alger · Bab Ezzouar · stop desk"
export function deliveryLine(
  order: Pick<Order, "wilayaName" | "commune" | "deliveryType">,
): string | null {
  if (!order.wilayaName) return null;
  return [order.wilayaName, order.commune, order.deliveryType === "desk" ? "stop desk" : null]
    .filter(Boolean)
    .join(" · ");
}

export const roleBadge: Record<UserRole, string> = {
  super_admin: "badge-accent",
  admin: "badge-info",
  customer: "badge-neutral",
};

// Chargily charges in Algerian dinars, so every price is shown in DZD.
const dzd = new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD" });
// Whole amounts without centimes: "3 500 DA", not "3 500,00 DA".
const dzdWhole = new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 });
const dzdCompact = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
  notation: "compact",
});

export function formatPrice(value: number | string): string {
  const amount = Number(value);
  return (Number.isInteger(amount) ? dzdWhole : dzd).format(amount);
}

// Short form for chart axes, e.g. "12 k DA".
export function formatPriceCompact(value: number | string): string {
  return dzdCompact.format(Number(value));
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
