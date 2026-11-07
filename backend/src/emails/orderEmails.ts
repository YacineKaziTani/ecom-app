import { email, renderLayout } from "./layout";
import { formatDzd } from "../utils/money";
import type { Order, OrderStatus } from "../entities/Order";
import type { OrderItem } from "../entities/OrderItem";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const shortId = (order: Pick<Order, "id">) => `#${order.id.slice(0, 8)}`;

function deliveryText(order: Order): string {
  const where = [order.wilayaName, order.commune].filter(Boolean).join(", ");
  const how = order.deliveryType === "desk" ? " (stop desk pick-up)" : "";
  return [order.shippingAddress, where].filter(Boolean).join(" — ") + how;
}

function totalsRows(order: Order) {
  const rows: [string, number, ("discount" | "strong")?][] = [];
  const discount = Number(order.discountAmount);
  const shipping = Number(order.shippingFee);
  if (discount > 0 || shipping > 0) rows.push(["Subtotal", Number(order.subtotal)]);
  if (discount > 0)
    rows.push([`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, discount, "discount"]);
  if (order.wilayaName) rows.push(["Delivery", shipping]);
  rows.push(["Total", Number(order.total), "strong"]);
  return rows;
}

function itemsText(items: OrderItem[]) {
  return items.map(
    (i) => `${i.productName} x${i.quantity} — ${formatDzd(Number(i.price) * i.quantity)}`,
  );
}

// Sent to the customer right after checkout.
export function orderPlacedEmail(order: Order, name: string, link: string): RenderedEmail {
  const cod = order.paymentMethod === "cod";
  const paymentNote = cod
    ? `You'll pay ${formatDzd(order.total)} in cash on delivery. We'll call ${order.phone ?? "you"} to confirm your order before it ships.`
    : order.paymentStatus === "paid"
      ? "Your payment has been received."
      : "Complete your payment to confirm the order — unpaid orders are released after a short while.";

  const html = renderLayout({
    title: "Order received",
    bodyHtml:
      email.heading(`Thanks, ${name}!`) +
      email.paragraph(`We've received your order ${shortId(order)}.`) +
      email.lines(order.items, totalsRows(order)) +
      email.muted(`Shipping to: ${deliveryText(order)}`) +
      email.paragraph(paymentNote),
    cta: { label: cod ? "View your order" : "View or pay for your order", url: link },
  });
  const text = [
    `Thanks, ${name}!`,
    `We've received your order ${shortId(order)}.`,
    "",
    ...itemsText(order.items),
    ...totalsRows(order).map(([label, amount, tone]) => `${label}: ${tone === "discount" ? "-" : ""}${formatDzd(amount)}`),
    `Shipping to: ${deliveryText(order)}`,
    "",
    paymentNote,
    `View your order: ${link}`,
  ].join("\n");
  return { subject: `Order received — ${shortId(order)}`, html, text };
}

const STATUS_COPY: Partial<Record<OrderStatus, { subject: string; heading: string; body: string }>> = {
  processing: {
    subject: "Your order is confirmed",
    heading: "Your order is confirmed",
    body: "The makers are preparing your items. We'll email you again when it ships.",
  },
  shipped: {
    subject: "Your order is on its way",
    heading: "Your order has shipped",
    body: "It's with the courier now — keep your phone nearby, they'll call before delivery.",
  },
  delivered: {
    subject: "Your order was delivered",
    heading: "Delivered — enjoy!",
    body: "Your order has been delivered. Thank you for supporting independent makers.",
  },
  cancelled: {
    subject: "Your order was cancelled",
    heading: "Your order was cancelled",
    body: "This order has been cancelled. If you think this is a mistake, reply to this email.",
  },
};

export function hasStatusEmail(status: OrderStatus): boolean {
  return status in STATUS_COPY;
}

// Sent to the customer when their order moves forward (or is cancelled).
export function orderStatusEmail(
  order: Order,
  status: OrderStatus,
  name: string,
  link: string,
  reason?: string,
): RenderedEmail {
  const copy = STATUS_COPY[status]!;
  const paid =
    status === "processing" && order.paymentMethod === "card" && order.paymentStatus === "paid"
      ? `Payment of ${formatDzd(order.total)} received. `
      : "";
  const body = `${paid}${reason ?? copy.body}`;
  const html = renderLayout({
    title: copy.subject,
    bodyHtml:
      email.heading(copy.heading) +
      email.paragraph(`Hi ${name}, an update on order ${shortId(order)}.`) +
      email.paragraph(body) +
      email.lines(order.items, [["Total", Number(order.total), "strong"]]),
    cta: { label: "View your order", url: link },
  });
  const text = [
    `Hi ${name},`,
    `${copy.heading} — order ${shortId(order)}.`,
    body,
    "",
    ...itemsText(order.items),
    `Total: ${formatDzd(order.total)}`,
    "",
    `View your order: ${link}`,
  ].join("\n");
  return { subject: `${copy.subject} — ${shortId(order)}`, html, text };
}

// Sent to a shop owner when an order containing their items is ready to fulfil.
export function newShopOrderEmail(
  order: Order,
  shopItems: OrderItem[],
  shopName: string,
  customerName: string,
  dashboardLink: string,
): RenderedEmail {
  const shopTotal = shopItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const payment =
    order.paymentMethod === "cod"
      ? "Payment: cash on delivery — confirm the order with the customer by phone."
      : "Payment: paid online.";
  const html = renderLayout({
    title: "New order",
    bodyHtml:
      email.heading(`New order for ${shopName}`) +
      email.paragraph(`Order ${shortId(order)} includes items from your shop.`) +
      email.lines(shopItems, [["Your items", shopTotal, "strong"]]) +
      email.muted(`Customer: ${customerName}${order.phone ? ` — ${order.phone}` : ""}`) +
      email.muted(`Deliver to: ${deliveryText(order)}`) +
      email.paragraph(payment),
    cta: { label: "Open your orders", url: dashboardLink },
  });
  const text = [
    `New order for ${shopName} — ${shortId(order)}`,
    "",
    ...itemsText(shopItems),
    `Your items: ${formatDzd(shopTotal)}`,
    `Customer: ${customerName}${order.phone ? ` — ${order.phone}` : ""}`,
    `Deliver to: ${deliveryText(order)}`,
    payment,
    "",
    `Open your orders: ${dashboardLink}`,
  ].join("\n");
  return { subject: `New order ${shortId(order)} — ${shopName}`, html, text };
}
