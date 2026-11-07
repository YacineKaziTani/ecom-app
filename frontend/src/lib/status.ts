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

// Chargily charges in Algerian dinars, so every price is shown in DZD.
const dzd = new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD" });
const dzdCompact = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
  notation: "compact",
});

export function formatPrice(value: number | string): string {
  return dzd.format(Number(value));
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
