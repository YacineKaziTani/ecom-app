import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { track } from "../utils/background";
import { Order, OrderStatus } from "../entities/Order";
import { Shop } from "../entities/Shop";
import * as mailer from "./email";
import {
  hasStatusEmail,
  newShopOrderEmail,
  orderPlacedEmail,
  orderStatusEmail,
} from "../emails/orderEmails";

// Who gets told what, and when:
//   checkout  → customer: "order received"; pay-on-delivery → shop owners too
//   card paid → customer: "confirmed, payment received"; shop owners
//   status    → customer: confirmed / shipped / delivered / cancelled
// Everything here runs after the HTTP response (see inBackground) and never
// throws into a request.

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

async function notifyShops(order: Order) {
  const shopIds = [...new Set(order.items.map((i) => i.shopId).filter(Boolean))] as string[];
  if (shopIds.length === 0) return;
  const shops = await AppDataSource.getRepository(Shop).find({
    where: { id: In(shopIds) },
    relations: ["owner"],
  });
  const customerName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`
    : order.guestName || order.guestEmail || "Guest";

  for (const shop of shops) {
    if (!shop.owner?.email) continue;
    const items = order.items.filter((i) => i.shopId === shop.id);
    await mailer.sendEmail(
      "shop-new-order",
      shop.owner.email,
      newShopOrderEmail(order, items, shop.name, customerName, `${clientUrl()}/dashboard/orders`),
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
  if (order.status !== "cancelled") await notifyShops(order);
}

export async function notifyStatusChange(
  orderId: string,
  status: OrderStatus,
  reason?: string,
) {
  if (!hasStatusEmail(status)) return;
  const order = await loadOrder(orderId);
  const customer = order && customerOf(order);
  if (!order || !customer) return;
  await mailer.sendEmail(
    "order-status",
    customer.email,
    orderStatusEmail(order, status, customer.name, customerLink(order, customer.email), reason),
  );
}

// Fire-and-forget wrapper: failures are logged, never surfaced to the caller.
export function inBackground(task: Promise<unknown>, context: Record<string, unknown>) {
  void track(task.catch((err) => logger.error({ err, ...context }, "Notification failed")));
}
