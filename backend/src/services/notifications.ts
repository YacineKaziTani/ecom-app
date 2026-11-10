import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { track } from "../utils/background";
import { CLOSED_STATUSES, Order, OrderStatus } from "../entities/Order";
import { Shop } from "../entities/Shop";
import * as mailer from "./email";
import {
  CancelReason,
  hasStatusEmail,
  newShopOrderEmail,
  orderPlacedEmail,
  orderStatusEmail,
  shopOrderCancelledEmail,
} from "../emails/orderEmails";
import { lowStockEmail } from "../emails/stockEmails";
import type { LowStockAlert } from "./inventory";

// Who gets told what, and when:
//   checkout  → customer: "order received"; pay-on-delivery → shop owners too
//   card paid → customer: "confirmed, payment received"; shop owners
//   status    → customer: confirmed / shipped / delivered / cancelled
//   customer cancels → customer: confirmation; shop owners: "don't ship it"
//   low stock → shop owners whose products (or options) a checkout left low
// Customers get emails in the language they ordered in (order.locale), shop
// owners in their own (users.locale). Everything here runs after the HTTP
// response (see inBackground) and never throws into a request.

const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

function loadOrder(id: string) {
  return AppDataSource.getRepository(Order).findOne({
    where: { id },
    relations: ["items", "user"],
  });
}

function customerOf(order: Order) {
  if (order.user) return { email: order.user.email, name: order.user.firstName };
  if (order.guestEmail) return { email: order.guestEmail, name: order.guestName || "there" };
  return null;
}

// Guests have no account, so their link carries the email that unlocks the
// public order lookup on the confirmation page.
function customerLink(order: Order, email: string) {
  const base = `${clientUrl()}/order-confirmation/${order.id}`;
  return order.userId ? base : `${base}?email=${encodeURIComponent(email)}`;
}

function shopsOf(shopIds: string[]) {
  return AppDataSource.getRepository(Shop).find({
    where: { id: In(shopIds) },
    relations: ["owner"],
  });
}

async function notifyShops(order: Order) {
  const shopIds = [...new Set(order.items.map((i) => i.shopId).filter(Boolean))] as string[];
  if (shopIds.length === 0) return;
  const customerName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : order.guestName || order.guestEmail || "Guest";

  for (const shop of await shopsOf(shopIds)) {
    if (!shop.owner?.email) continue;
    const items = order.items.filter((i) => i.shopId === shop.id);
    await mailer.sendEmail(
      "shop-new-order",
      shop.owner.email,
      newShopOrderEmail(order, items, shop.name, customerName, `${clientUrl()}/dashboard/orders`, shop.owner.locale),
    );
  }
}

export async function notifyOrderPlaced(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order) return;
  const customer = customerOf(order);
  if (customer) {
    await mailer.sendEmail(
      "order-placed",
      customer.email,
      orderPlacedEmail(order, customer.name, customerLink(order, customer.email)),
    );
  }
  // Card orders reach the shops once the payment lands (notifyOrderPaid).
  if (order.paymentMethod === "cod") await notifyShops(order);
}

export async function notifyOrderPaid(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order) return;
  const customer = customerOf(order);
  if (customer && order.status === "processing") {
    await mailer.sendEmail(
      "order-status",
      customer.email,
      orderStatusEmail(order, "processing", customer.name, customerLink(order, customer.email)),
    );
  }
  if (!CLOSED_STATUSES.includes(order.status)) await notifyShops(order);
}

export async function notifyStatusChange(
  orderId: string,
  status: OrderStatus,
  reason?: CancelReason,
) {
  if (!hasStatusEmail(status)) return;
  const order = await loadOrder(orderId);
  if (order) await sendStatusEmail(order, status, reason);
}

async function sendStatusEmail(order: Order, status: OrderStatus, reason?: CancelReason) {
  const customer = customerOf(order);
  if (!customer) return;
  await mailer.sendEmail(
    "order-status",
    customer.email,
    orderStatusEmail(order, status, customer.name, customerLink(order, customer.email), reason),
  );
}

// The customer cancelled before shipping: confirm it to them, and tell each
// shop not to send its part.
export async function notifyCustomerCancelled(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order) return;
  await sendStatusEmail(order, "cancelled", "customer");
  // Shops only hear about a card order once it's paid (notifyOrderPaid), and
  // paid card orders can't be cancelled by the customer — so only
  // pay-on-delivery shops have something to stop.
  if (order.paymentMethod !== "cod") return;
  const shopIds = [...new Set(order.items.map((i) => i.shopId).filter(Boolean))] as string[];
  for (const shop of shopIds.length ? await shopsOf(shopIds) : []) {
    if (!shop.owner?.email) continue;
    await mailer.sendEmail(
      "shop-order-cancelled",
      shop.owner.email,
      shopOrderCancelledEmail(
        order,
        order.items.filter((i) => i.shopId === shop.id),
        `${clientUrl()}/dashboard/orders`,
        shop.owner.locale,
      ),
    );
  }
}

export async function notifyLowStock(alerts: LowStockAlert[]) {
  const shopIds = [...new Set(alerts.map((a) => a.shopId))];
  if (shopIds.length === 0) return;
  for (const shop of await shopsOf(shopIds)) {
    if (!shop.owner?.email) continue;
    await mailer.sendEmail(
      "low-stock",
      shop.owner.email,
      lowStockEmail(
        shop.name,
        alerts.filter((a) => a.shopId === shop.id),
        `${clientUrl()}/dashboard/products`,
        shop.owner.locale,
      ),
    );
  }
}

// Fire-and-forget wrapper: failures are logged, never surfaced to the caller.
export function inBackground(task: Promise<unknown>, context: Record<string, unknown>) {
  void track(task.catch((err) => logger.error({ err, ...context }, "Notification failed")));
}
