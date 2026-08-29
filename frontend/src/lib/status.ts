import { OrderStatus, PaymentStatus, UserRole } from "../api/types";

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

export const roleBadge: Record<UserRole, string> = {
  super_admin: "badge-accent",
  admin: "badge-info",
  customer: "badge-neutral",
};

export function formatPrice(value: number | string): string {
  return `$${Number(value).toFixed(2)}`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
