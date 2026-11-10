import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { Order } from "../entities/Order";
import { verifyChargilySignature } from "../services/chargily";
import { loadOrderForUpdate, setOrderStatus } from "../services/orderLifecycle";
import { HttpError } from "../utils/httpError";
import * as notifications from "../services/notifications";

const router = Router();

router.post("/", async (req, res) => {
  const signature = req.header("signature");
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : "";

  if (!signature || !rawBody || !verifyChargilySignature(rawBody, signature)) {
    return res.status(403).json({ message: "Invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const checkoutId: string | undefined = event?.data?.id;
  const type: string | undefined = event?.type;
  if (!checkoutId || !type) return res.status(200).json({ received: true });

  const match = await AppDataSource.getRepository(Order).findOne({
    where: { paymentCheckoutId: checkoutId },
    select: { id: true },
  });
  if (!match) return res.status(200).json({ received: true });

  let newlyPaid = false;
  await AppDataSource.transaction(async (manager) => {
    // Locked, so a webhook can't race the reservation-expiry job or an admin.
    const order = await loadOrderForUpdate(manager, match.id);
    if (!order) return;

    if (type === "checkout.paid") {
      newlyPaid = order.paymentStatus !== "paid";
      await manager.getRepository(Order).update(order.id, {
        paymentStatus: "paid",
        reservedUntil: null,
      });
      order.paymentStatus = "paid";

      if (order.status === "pending") {
        await setOrderStatus(manager, order, "processing");
      } else if (order.status === "cancelled" && order.cancelledBy === "customer") {
        // The customer cancelled it themselves: never ship it because a
        // payment page left open went through. The money is recorded as
        // received, so staff can refund it.
        logger.warn({ orderId: order.id }, "Payment received for an order the customer cancelled — refund needed");
      } else if (order.status === "cancelled") {
        // Paid after the reservation expired (or after an admin cancelled it).
        // Re-reserve the stock if it's still there; otherwise the money came
        // in for items we no longer have — leave it for a refund.
        try {
          await setOrderStatus(manager, order, "processing");
          logger.info({ orderId: order.id }, "Reactivated cancelled order after late payment");
        } catch (err) {
          if (!(err instanceof HttpError)) throw err;
          logger.warn(
            { orderId: order.id, issues: err.body.issues },
            "Payment received for a cancelled order whose stock is gone — refund needed",
          );
        }
      }
    } else if (type === "checkout.failed" || type === "checkout.canceled") {
      // A late/duplicate failure event must never downgrade a paid order.
      if (order.paymentStatus !== "paid") {
        await manager
          .getRepository(Order)
          .update(order.id, { paymentStatus: "failed" });
      }
    }
  });

  res.status(200).json({ received: true });
  if (newlyPaid) {
    notifications.inBackground(notifications.notifyOrderPaid(match.id), {
      orderId: match.id,
    });
  }
});

export default router;
