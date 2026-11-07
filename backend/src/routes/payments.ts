import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { optionalAuth } from "../middleware/auth";
import { createChargilyCheckout } from "../services/chargily";
import { reservationDeadline } from "../services/orderLifecycle";
import { logger } from "../config/logger";

const router = Router();
const orderRepo = () => AppDataSource.getRepository(Order);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const API_PUBLIC_URL =
  process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

const createCheckoutSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().max(254).optional(), // required for guest orders
});

router.post("/create-checkout", optionalAuth, async (req, res) => {
  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const order = await orderRepo().findOne({
    where: { id: parsed.data.orderId },
  });
  if (!order) return res.status(404).json({ message: "Order not found" });

  // Same access rules as viewing the order: an account order needs its owner
  // signed in; a guest order needs the email used at checkout (like
  // /orders/track). Starting a checkout overwrites paymentCheckoutId, so this
  // must not be callable by anyone who merely knows the order id.
  if (order.userId) {
    if (!req.user)
      return res
        .status(401)
        .json({ message: "Please sign in to pay for this order" });
    if (order.userId !== req.user.id)
      return res.status(404).json({ message: "Order not found" });
  } else if (
    !order.guestEmail ||
    order.guestEmail.toLowerCase() !== parsed.data.email?.toLowerCase()
  ) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.paymentStatus === "paid") {
    return res
      .status(400)
      .json({ message: "This order has already been paid" });
  }
  if (order.status === "cancelled") {
    return res
      .status(400)
      .json({ message: "This order was cancelled and can't be paid" });
  }

  const query = order.guestEmail
    ? `order=${order.id}&email=${encodeURIComponent(order.guestEmail)}`
    : `order=${order.id}`;

  try {
    const checkout = await createChargilyCheckout({
      amount: Math.round(Number(order.total)),
      orderId: order.id,
      successUrl: `${CLIENT_URL}/payment/success?${query}`,
      failureUrl: `${CLIENT_URL}/payment/failure?${query}`,
      webhookUrl: `${API_PUBLIC_URL}/api/payments/webhook`,
      description: `Order #${order.id.slice(0, 8)}`,
    });

    order.paymentProvider = "chargily";
    order.paymentCheckoutId = checkout.id;
    // Each payment attempt gets a full reservation window to complete in.
    order.reservedUntil = reservationDeadline();
    await orderRepo().save(order);

    res.json({ checkoutUrl: checkout.checkout_url });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Chargily checkout creation failed");
    res
      .status(502)
      .json({ message: "Could not start payment — please try again shortly" });
  }
});

export default router;
