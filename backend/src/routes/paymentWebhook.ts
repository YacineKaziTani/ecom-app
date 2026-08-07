import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { verifyChargilySignature } from "../services/chargily";

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
  if (!checkoutId) return res.status(200).json({ received: true });

  const orderRepo = AppDataSource.getRepository(Order);
  const order = await orderRepo.findOne({
    where: { paymentCheckoutId: checkoutId },
  });
  if (!order) return res.status(200).json({ received: true });

  switch (event.type) {
    case "checkout.paid":
      order.paymentStatus = "paid";
      if (order.status === "pending") order.status = "processing";
      break;
    case "checkout.failed":
    case "checkout.canceled":
      order.paymentStatus = "failed";
      break;
    default:
      return res.status(200).json({ received: true });
  }

  await orderRepo.save(order);
  res.status(200).json({ received: true });
});

export default router;
