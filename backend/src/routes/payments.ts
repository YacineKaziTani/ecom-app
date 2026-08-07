import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { optionalAuth } from "../middleware/auth";
import { createChargilyCheckout } from "../services/chargily";

const router = Router();
const orderRepo = () => AppDataSource.getRepository(Order);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const API_PUBLIC_URL =
  process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

const createCheckoutSchema = z.object({ orderId: z.string().uuid() });

router.post("/create-checkout", optionalAuth, async (req, res) => {
  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const order = await orderRepo().findOne({
    where: { id: parsed.data.orderId },
  });
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (req.user && order.userId && order.userId !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (order.paymentStatus === "paid") {
    return res
      .status(400)
      .json({ message: "This order has already been paid" });
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
    res
      .status(502)
      .json({ message: "Could not start payment — please try again shortly" });
  }
});

export default router;
