import { EntityManager, In, LessThan, Not } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Coupon } from "../entities/Coupon";
import { Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Product } from "../entities/Product";
import { StockIssue, stockConflict } from "../utils/httpError";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";
import * as notifications from "./notifications";
import { syncShipments } from "./fulfilment";

// How long an unpaid order keeps its items out of stock. Each new payment
// attempt ("Pay now") restarts the clock.
export const RESERVATION_MINUTES =
  Number(process.env.ORDER_RESERVATION_MINUTES) || 30;

export function reservationDeadline(from = new Date()): Date {
  return new Date(from.getTime() + RESERVATION_MINUTES * 60_000);
}

// Loads and row-locks (SELECT ... FOR UPDATE) the given products for the rest
// of the transaction, so two concurrent checkouts can't both pass the stock
// check and oversell. Locked in id order so concurrent transactions acquire
// locks in the same order and can't deadlock each other.
export async function lockProducts(manager: EntityManager, ids: string[]) {
  if (ids.length === 0) return new Map<string, Product>();
  const products = await manager.getRepository(Product).find({
    where: { id: In(ids) },
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  return new Map(products.map((p) => [p.id, p]));
}

// Locks the order row (so two concurrent status changes can't both act on the
// old status) and loads its items. Must be called inside a transaction.
export async function loadOrderForUpdate(
  manager: EntityManager,
  id: string,
): Promise<Order | null> {
  // The lock goes on the order alone: Postgres can't FOR UPDATE the nullable
  // side of the LEFT JOIN that loading `items` as a relation would produce.
  const order = await manager.getRepository(Order).findOne({
    where: { id },
    lock: { mode: "pessimistic_write" },
  });
  if (!order) return null;
  order.items = await manager
    .getRepository(OrderItem)
    .find({ where: { orderId: id } });
  return order;
}

async function adjustCouponUsage(
  manager: EntityManager,
  code: string | undefined,
  direction: "consume" | "release",
) {
  if (!code) return;
  await manager
    .createQueryBuilder()
    .update(Coupon)
    .set({
      usedCount: () =>
        direction === "consume"
          ? `"usedCount" + 1`
          : `GREATEST("usedCount" - 1, 0)`,
    })
    .where("code = :code", { code })
    .execute();
}

// Moves an order (from loadOrderForUpdate, same transaction) to `newStatus`,
// keeping stock and coupon usage in sync:
//   → cancelled: items go back into stock, the coupon use is released
//   cancelled →: stock is re-reserved (409 if it's no longer there) and the
//                coupon use is consumed again
// Same status twice is a no-op, so nothing is ever restocked twice.
//
// Every shop's shipment follows the order unless `syncShipments` is false
// (used when the order status is itself being rolled up from shipments).
export async function setOrderStatus(
  manager: EntityManager,
  order: Order,
  newStatus: OrderStatus,
  { syncShipments: sync = true }: { syncShipments?: boolean } = {},
): Promise<Order> {
  if (order.status === newStatus) return order;

  const entering = newStatus === "cancelled";
  const leaving = order.status === "cancelled";

  if (entering || leaving) {
    // Items whose product was deleted since the order was placed are skipped.
    const lines = order.items.filter((i) => i.productId);
    const products = await lockProducts(
      manager,
      lines.map((i) => i.productId!),
    );

    if (leaving) {
      // Stock may have been bought up while the order was cancelled.
      const issues: StockIssue[] = lines
        .filter((i) => (products.get(i.productId!)?.stock ?? 0) < i.quantity)
        .map((i) => ({
          productId: i.productId!,
          productName: i.productName,
          availableStock: products.get(i.productId!)?.stock ?? 0,
          requestedQuantity: i.quantity,
        }));
      if (issues.length > 0) {
        throw stockConflict(
          "Can't reactivate this order — some items no longer have enough stock",
          issues,
        );
      }
    }

    for (const item of lines) {
      const product = products.get(item.productId!);
      if (!product) continue;
      product.stock += entering ? item.quantity : -item.quantity;
      await manager.save(product);
    }
    await adjustCouponUsage(
      manager,
      order.couponCode,
      entering ? "release" : "consume",
    );
  }

  const changes: Partial<Order> = { status: newStatus };
  if (entering) changes.reservedUntil = null;
  // Pay on delivery: the courier collects the cash when the parcel is handed over.
  if (
    newStatus === "delivered" &&
    order.paymentMethod === "cod" &&
    order.paymentStatus !== "paid"
  ) {
    changes.paymentStatus = "paid";
  }
  await manager.getRepository(Order).update(order.id, changes);
  if (sync) await syncShipments(manager, order.id, newStatus);
  Object.assign(order, changes);
  return order;
}

// Cancels unpaid orders whose reservation has run out, releasing their stock.
// Safe to run from several instances at once: every order is re-checked under
// its row lock before anything changes.
export async function expireUnpaidOrders(now = new Date()): Promise<number> {
  const candidates = await AppDataSource.getRepository(Order).find({
    select: { id: true },
    where: {
      status: "pending",
      paymentMethod: "card",
      paymentStatus: Not("paid"),
      reservedUntil: LessThan(now),
    },
    order: { reservedUntil: "ASC" },
    take: 100,
  });

  let expired = 0;
  for (const { id } of candidates) {
    const cancelled = await AppDataSource.transaction(async (manager) => {
      const order = await loadOrderForUpdate(manager, id);
      if (
        !order ||
        order.status !== "pending" ||
        order.paymentMethod !== "card" ||
        order.paymentStatus === "paid" ||
        !order.reservedUntil ||
        order.reservedUntil > now
      ) {
        return false; // paid or changed since we looked
      }
      await setOrderStatus(manager, order, "cancelled");
      return true;
    });
    if (cancelled) {
      expired++;
      notifications.inBackground(
        notifications.notifyStatusChange(
          id,
          "cancelled",
          "We cancelled this order because the payment wasn't completed in time, and released the items. You're welcome to order again.",
        ),
        { orderId: id },
      );
    }
  }
  return expired;
}

// Runs expireUnpaidOrders on an interval. Returns a function that stops it.
export function startReservationExpiryJob(intervalMs = 60_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const count = await expireUnpaidOrders();
      if (count > 0)
        logger.info({ count }, "Cancelled unpaid orders past their reservation");
    } catch (err) {
      logger.error({ err }, "Reservation expiry job failed");
      Sentry.captureException(err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
