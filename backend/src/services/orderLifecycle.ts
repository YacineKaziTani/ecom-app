import { EntityManager, LessThan, Not } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Coupon } from "../entities/Coupon";
import { CLOSED_STATUSES, Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { stockConflict } from "../utils/httpError";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";
import * as notifications from "./notifications";
import { syncShipments } from "./fulfilment";
import { applyStockChanges, lockStock } from "./inventory";

// How long an unpaid order keeps its items out of stock. Each new payment
// attempt ("Pay now") restarts the clock.
export const RESERVATION_MINUTES =
  Number(process.env.ORDER_RESERVATION_MINUTES) || 30;

export function reservationDeadline(from = new Date()): Date {
  return new Date(from.getTime() + RESERVATION_MINUTES * 60_000);
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
//   → cancelled / returned: items go back into stock, the coupon use is released
//   cancelled / returned →: stock is re-reserved (409 if it's no longer there)
//                           and the coupon use is consumed again
// Moving between the two closed states (cancelled ↔ returned) touches nothing.
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

  const entering = CLOSED_STATUSES.includes(newStatus) && !CLOSED_STATUSES.includes(order.status);
  const leaving = CLOSED_STATUSES.includes(order.status) && !CLOSED_STATUSES.includes(newStatus);

  if (entering || leaving) {
    // Items whose product or option was deleted since the order was placed
    // have no stock left to give back or take, so they're skipped.
    const lines = order.items
      .filter((i) => i.productId && !(i.variantName && !i.variantId))
      .map((i) => ({
        productId: i.productId!,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
        productName: i.productName,
        variantName: i.variantName,
      }));
    const stock = await lockStock(manager, lines.map((l) => l.productId));
    const tracked = lines.filter((l) => stock.holder(l.productId, l.variantId));

    if (leaving) {
      // Stock may have been bought up while the order was cancelled.
      const issues = tracked
        .filter((l) => stock.available(l) < l.quantity)
        .map((l) => stock.issue(l, l));
      if (issues.length > 0) {
        throw stockConflict(
          "Can't reactivate this order — some items no longer have enough stock",
          issues,
        );
      }
    }

    await applyStockChanges(
      manager,
      stock,
      tracked.map((l) => ({ ...l, delta: entering ? l.quantity : -l.quantity })),
    );
    await adjustCouponUsage(
      manager,
      order.couponCode,
      entering ? "release" : "consume",
    );
  }

  const changes: Partial<Order> = { status: newStatus };
  if (entering) changes.reservedUntil = null;
  if (leaving) {
    // Reactivated: it's no longer a cancellation or a return.
    changes.cancelledBy = null;
    changes.returnedAt = null;
    changes.returnReason = null;
    changes.returnCost = 0;
  }
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
        notifications.notifyStatusChange(id, "cancelled", "expired"),
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
