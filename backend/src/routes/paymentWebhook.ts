import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { verifyChargilySignature } from "../services/chargily";

const router = Router();

// This route is mounted BEFORE the app's global express.json() middleware,
// with its own express.raw() parser (see index.ts) — signature verification
// needs the exact raw bytes Chargily sent, not a re-serialized copy of the
// parsed JSON, which can differ in whitespace/key order and would make every
// signature check fail.
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
  if (!checkoutId) return res.status(200).json({ received: true }); // nothing actionable — ack anyway

  const orderRepo = AppDataSource.getRepository(Order);
  const order = await orderRepo.findOne({ where: { paymentCheckoutId: checkoutId } });
  // Unknown checkout id (e.g. a stale/overwritten one from a repeated "pay now"
  // click — see the comment on Order.paymentCheckoutId) — ack so Chargily
  // doesn't keep retrying, but there's nothing for us to update.
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
      // Unrecognized event type — ack without acting, rather than guessing.
      return res.status(200).json({ received: true });
  }

  await orderRepo.save(order);
  res.status(200).json({ received: true });
});

export default router;
