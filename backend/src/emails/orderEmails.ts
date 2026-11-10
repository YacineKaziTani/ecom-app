import { email, itemLabel, renderLayout } from "./layout";
import { formatDzd } from "../utils/money";
import { Locale, Translate, translator } from "./i18n";
import type { Order, OrderStatus } from "../entities/Order";
import type { OrderItem } from "../entities/OrderItem";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Why an order was cancelled, when the customer should be told.
export type CancelReason = "expired" | "declined" | "wrongNumber" | "customer";

const shortId = (order: Pick<Order, "id">) => `#${order.id.slice(0, 8)}`;

function deliveryText(order: Order, t: Translate): string {
  const where = [order.wilayaName, order.commune].filter(Boolean).join(", ");
  const how = order.deliveryType === "desk" ? t("order.stopDesk") : "";
  return [order.shippingAddress, where].filter(Boolean).join(" — ") + how;
}

function totalsRows(order: Order, t: Translate) {
  const rows: [string, number, ("discount" | "strong")?][] = [];
  const discount = Number(order.discountAmount);
  const shipping = Number(order.shippingFee);
  if (discount > 0 || shipping > 0) rows.push([t("order.subtotal"), Number(order.subtotal)]);
  if (discount > 0)
    rows.push([`${t("order.discount")}${order.couponCode ? ` (${order.couponCode})` : ""}`, discount, "discount"]);
  if (order.wilayaName) rows.push([t("order.delivery"), shipping]);
  rows.push([t("order.total"), Number(order.total), "strong"]);
  return rows;
}

function itemsText(items: OrderItem[]) {
  return items.map(
    (i) => `${itemLabel(i)} x${i.quantity} — ${formatDzd(Number(i.price) * i.quantity)}`,
  );
}

// Sent to the customer right after checkout, in the language they ordered in.
export function orderPlacedEmail(order: Order, name: string, link: string): RenderedEmail {
  const locale = order.locale;
  const t = translator(locale);
  const cod = order.paymentMethod === "cod";
  const paymentNote = cod
    ? t("placed.cod", { total: formatDzd(order.total), phone: order.phone ?? "—" })
    : order.paymentStatus === "paid"
      ? t("placed.paid")
      : t("placed.unpaid");
  const shipping = t("order.shippingTo", { address: deliveryText(order, t) });
  const cta = { label: cod ? t("order.view") : t("order.viewOrPay"), url: link };

  const html = renderLayout({
    title: t("placed.title"),
    bodyHtml:
      email.heading(t("placed.heading", { name })) +
      email.paragraph(t("placed.received", { id: shortId(order) })) +
      email.lines(order.items, totalsRows(order, t), locale) +
      email.muted(shipping) +
      email.paragraph(paymentNote),
    cta,
    locale,
  });
  const text = [
    t("placed.heading", { name }),
    t("placed.received", { id: shortId(order) }),
    "",
    ...itemsText(order.items),
    ...totalsRows(order, t).map(([label, amount, tone]) => `${label}: ${tone === "discount" ? "-" : ""}${formatDzd(amount)}`),
    shipping,
    "",
    paymentNote,
    `${cta.label}: ${link}`,
  ].join("\n");
  return { subject: t("placed.subject", { id: shortId(order) }), html, text };
}

const STATUS_EMAILS = ["processing", "shipped", "delivered", "cancelled"] as const;
type EmailedStatus = (typeof STATUS_EMAILS)[number];

export function hasStatusEmail(status: OrderStatus): status is EmailedStatus {
  return (STATUS_EMAILS as readonly string[]).includes(status);
}

// Sent to the customer when their order moves forward (or is cancelled).
export function orderStatusEmail(
  order: Order,
  status: OrderStatus,
  name: string,
  link: string,
  reason?: CancelReason,
): RenderedEmail {
  if (!hasStatusEmail(status)) throw new Error(`No email for status "${status}"`);
  const locale = order.locale;
  const t = translator(locale);
  const subject = t(`status.${status}.subject`);
  const heading = t(`status.${status}.heading`);
  const paid =
    status === "processing" && order.paymentMethod === "card" && order.paymentStatus === "paid"
      ? `${t("status.paymentReceived", { total: formatDzd(order.total) })} `
      : "";
  const body = `${paid}${reason ? t(`reason.${reason}`) : t(`status.${status}.body`)}`;
  const greeting = t("status.update", { name, id: shortId(order) });

  const html = renderLayout({
    title: subject,
    bodyHtml:
      email.heading(heading) +
      email.paragraph(greeting) +
      email.paragraph(body) +
      email.lines(order.items, [[t("order.total"), Number(order.total), "strong"]], locale),
    cta: { label: t("order.view"), url: link },
    locale,
  });
  const text = [
    greeting,
    `${heading} — ${shortId(order)}.`,
    body,
    "",
    ...itemsText(order.items),
    `${t("order.total")}: ${formatDzd(order.total)}`,
    "",
    `${t("order.view")}: ${link}`,
  ].join("\n");
  return { subject: `${subject} — ${shortId(order)}`, html, text };
}

// Sent to a shop owner (in their language) when an order containing their
// items is ready to fulfil.
export function newShopOrderEmail(
  order: Order,
  shopItems: OrderItem[],
  shopName: string,
  customerName: string,
  dashboardLink: string,
  locale: Locale = "en",
): RenderedEmail {
  const t = translator(locale);
  const shopTotal = shopItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const payment = order.paymentMethod === "cod" ? t("shopOrder.cod") : t("shopOrder.card");
  const customer = t("shopOrder.customer", { customer: `${customerName}${order.phone ? ` — ${order.phone}` : ""}` });
  const deliverTo = t("shopOrder.deliverTo", { address: deliveryText(order, t) });
  const html = renderLayout({
    title: t("shopOrder.title"),
    bodyHtml:
      email.heading(t("shopOrder.heading", { shop: shopName })) +
      email.paragraph(t("shopOrder.includes", { id: shortId(order) })) +
      email.lines(shopItems, [[t("shopOrder.yourItems"), shopTotal, "strong"]], locale) +
      email.muted(customer) +
      email.muted(deliverTo) +
      email.paragraph(payment),
    cta: { label: t("shopOrder.cta"), url: dashboardLink },
    locale,
  });
  const text = [
    `${t("shopOrder.heading", { shop: shopName })} — ${shortId(order)}`,
    "",
    ...itemsText(shopItems),
    `${t("shopOrder.yourItems")}: ${formatDzd(shopTotal)}`,
    customer,
    deliverTo,
    payment,
    "",
    `${t("shopOrder.cta")}: ${dashboardLink}`,
  ].join("\n");
  return { subject: t("shopOrder.subject", { id: shortId(order), shop: shopName }), html, text };
}

// Sent to a shop owner when the customer cancels before anything shipped.
export function shopOrderCancelledEmail(
  order: Order,
  shopItems: OrderItem[],
  dashboardLink: string,
  locale: Locale = "en",
): RenderedEmail {
  const t = translator(locale);
  const body = t("shopCancel.body", { id: shortId(order) });
  const html = renderLayout({
    title: t("shopCancel.heading"),
    bodyHtml:
      email.heading(t("shopCancel.heading")) +
      email.paragraph(body) +
      email.lines(shopItems, [], locale),
    cta: { label: t("shopOrder.cta"), url: dashboardLink },
    locale,
  });
  const text = [t("shopCancel.heading"), "", body, "", ...itemsText(shopItems), "", `${t("shopOrder.cta")}: ${dashboardLink}`].join("\n");
  return { subject: t("shopCancel.subject", { id: shortId(order) }), html, text };
}
