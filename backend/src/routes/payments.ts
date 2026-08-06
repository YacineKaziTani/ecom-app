import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { optionalAuth } from "../middleware/auth";
import { createChargilyCheckout } from "../services/chargily";

const router = Router();
const orderRepo = () => AppDataSource.getRepository(Order);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
// Must be a publicly reachable URL for Chargily's servers to deliver the webhook to.
// In local dev this needs a tunnel (ngrok, etc.) — see README. Falls back to
// CLIENT_URL's origin swapped for the API port as a dev-friendly default, but
// that only works if you're tunneling the API itself, not the frontend.
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

const createCheckoutSchema = z.object({ orderId: z.string().uuid() });

// Starts (or restarts) a Chargily payment attempt for an order that already
// exists — this is a distinct step from order creation itself, since the order
// is created first (stock reserved, confirmation email queued) and payment is
// collected as a follow-up redirect to Chargily's hosted checkout page.
router.post("/create-checkout", optionalAuth, async (req, res) => {
  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const order = await orderRepo().findOne({ where: { id: parsed.data.orderId } });
  if (!order) return res.status(404).json({ message: "Order not found" });

  // Light ownership check: a logged-in caller must own the order. Guest orders
  // are matched purely by (unguessable) order id, same trust model as the
  // guest order-tracking endpoint — paying someone else's order isn't really
  // an exploitable action, it just marks it paid on their behalf.
  if (req.user && order.userId && order.userId !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (order.paymentStatus === "paid") {
    return res.status(400).json({ message: "This order has already been paid" });
  }

  try {
    const successUrl = order.guestEmail
      ? `${CLIENT_URL}/payment/success?order=${order.id}&email=${encodeURIComponent(order.guestEmail)}`
      : `${CLIENT_URL}/payment/success?order=${order.id}`;
    const failureUrl = order.guestEmail
      ? `${CLIENT_URL}/payment/failure?order=${order.id}&email=${encodeURIComponent(order.guestEmail)}`
      : `${CLIENT_URL}/payment/failure?order=${order.id}`;

    const checkout = await createChargilyCheckout({
      amount: Math.round(Number(order.total)),
      orderId: order.id,
      successUrl,
      failureUrl,
      webhookUrl: `${API_PUBLIC_URL}/api/payments/webhook`,
      description: `Order #${order.id.slice(0, 8)}`,
    });

    order.paymentProvider = "chargily";
    order.paymentCheckoutId = checkout.id;
    await orderRepo().save(order);

    res.json({ checkoutUrl: checkout.checkout_url });
  } catch (err) {
    console.error("Chargily checkout creation failed:", err);
    res.status(502).json({ message: "Could not start payment — please try again shortly" });
  }
});

export default router;
