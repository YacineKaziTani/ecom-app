import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Product } from "../entities/Product";
import { User } from "../entities/User";
import { requireAuth, requireAnyAdmin, attachShop, optionalAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { addressSchema } from "../utils/validators";
import { sendOrderConfirmationEmail } from "../services/email";
import { applyCouponWithLock, CouponError } from "../services/coupons";

const router = Router();
const orderRepo = () => AppDataSource.getRepository(Order);
const productRepo = () => AppDataSource.getRepository(Product);

// Customer: own orders only.
// super_admin: every order, full item list.
// admin: every order that contains at least one of their shop's items — but the
//        `items` array is filtered down to just their own shop's lines.
router.get("/", requireAuth, attachShop, async (req, res) => {
  const role = req.user!.role;

  if (role === "customer") {
    const orders = await orderRepo().find({
      where: { userId: req.user!.id },
      relations: ["items", "user"],
      order: { createdAt: "DESC" },
    });
    return res.json(orders);
  }

  const orders = await orderRepo().find({ relations: ["items", "user"], order: { createdAt: "DESC" } });

  if (role === "super_admin") return res.json(orders);

  // role === "admin" — scope to their shop
  const scoped = orders
    .map((order) => ({ ...order, items: order.items.filter((i) => i.shopId === req.shopId) }))
    .filter((order) => order.items.length > 0);

  res.json(scoped);
});

router.get("/:id", validateUuidParam(), requireAuth, attachShop, async (req, res) => {
  const order = await orderRepo().findOne({ where: { id: req.params.id }, relations: ["items", "user"] });
  if (!order) return res.status(404).json({ message: "Order not found" });

  const role = req.user!.role;
  if (role === "customer" && order.userId !== req.user!.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (role === "admin") {
    const myItems = order.items.filter((i) => i.shopId === req.shopId);
    if (myItems.length === 0) return res.status(403).json({ message: "Forbidden" });
    return res.json({ ...order, items: myItems });
  }

  res.json(order);
});

const createOrderSchema = z.object({
  shippingAddress: addressSchema,
  guestEmail: z.string().trim().toLowerCase().email().max(254).optional(), // required if not logged in
  guestName: z.string().trim().min(1).max(80).optional(), // used to personalize the confirmation email
  couponCode: z.string().trim().min(1).max(30).optional(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive().max(1000) }))
    .min(1)
    .max(50),
});

router.post("/", optionalAuth, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { shippingAddress, items, guestEmail, guestName, couponCode } = parsed.data;

  if (!req.user && !guestEmail) {
    return res.status(400).json({ message: "An email is required to check out as a guest" });
  }

  // Optional client-supplied key so a retried request (network timeout, a
  // double-click that slipped past the disabled button, etc.) returns the
  // SAME order instead of creating a duplicate. Cap the length defensively —
  // this only ever needs to hold a UUID-sized value.
  const idempotencyKeyHeader = req.header("Idempotency-Key");
  const idempotencyKey = idempotencyKeyHeader ? idempotencyKeyHeader.slice(0, 200) : undefined;

  if (idempotencyKey) {
    const existing = await orderRepo().findOne({ where: { idempotencyKey }, relations: ["items"] });
    if (existing) {
      // Already processed this exact checkout attempt — hand back the same
      // order (200, not 201, since nothing new was created) without re-sending
      // the confirmation email or touching stock again.
      return res.status(200).json(existing);
    }
  }

  try {
    const order = await AppDataSource.transaction(async (manager) => {
      const txProductRepo = manager.getRepository(Product);

      // First pass: validate everything before touching stock, and collect ALL
      // problems (not just the first one) so the client can fix the whole cart at once.
      const issues: { productId: string; productName?: string; availableStock: number; requestedQuantity: number }[] = [];
      const products = new Map<string, Product>();

      for (const item of items) {
        const product = await txProductRepo.findOne({ where: { id: item.productId } });
        if (!product) {
          issues.push({ productId: item.productId, availableStock: 0, requestedQuantity: item.quantity });
          continue;
        }
        products.set(item.productId, product);
        if (product.stock < item.quantity) {
          issues.push({
            productId: product.id,
            productName: product.name,
            availableStock: product.stock,
            requestedQuantity: item.quantity,
          });
        }
      }

      if (issues.length > 0) {
        const err: any = new Error("Some items are no longer available in the requested quantity");
        err.statusCode = 409;
        err.issues = issues;
        throw err;
      }

      const orderItems: OrderItem[] = [];
      let subtotal = 0;

      for (const item of items) {
        const product = products.get(item.productId)!;
        const orderItem = new OrderItem();
        orderItem.productId = product.id;
        orderItem.shopId = product.shopId;
        orderItem.productName = product.name;
        orderItem.price = product.price;
        orderItem.quantity = item.quantity;
        orderItems.push(orderItem);
        subtotal += Number(product.price) * item.quantity;

        product.stock -= item.quantity;
        await txProductRepo.save(product);
      }

      let discountAmount = 0;
      let appliedCouponCode: string | undefined;

      if (couponCode) {
        // Locks the coupon row for the rest of this transaction — see
        // applyCouponWithLock's comment for why this matters under concurrency.
        const { coupon, discountAmount: discount } = await applyCouponWithLock(
          manager,
          couponCode,
          subtotal,
          orderItems.map((i) => i.shopId!)
        );
        discountAmount = discount;
        appliedCouponCode = coupon.code;
      }

      const newOrder = manager.getRepository(Order).create({
        userId: req.user?.id,
        guestEmail: req.user ? undefined : guestEmail,
        guestName: req.user ? undefined : guestName,
        shippingAddress,
        subtotal,
        discountAmount,
        couponCode: appliedCouponCode,
        total: subtotal - discountAmount,
        status: "pending",
        items: orderItems,
        idempotencyKey,
      });
      return manager.getRepository(Order).save(newOrder);
    });

    res.status(201).json(order);

    // Fire the confirmation email after responding — a slow or failing SMTP
    // provider should never delay or break the checkout response itself.
    let recipientEmail = guestEmail;
    let recipientName = guestName || "there";
    if (req.user) {
      const registeredUser = await AppDataSource.getRepository(User).findOne({ where: { id: req.user.id } });
      if (registeredUser) {
        recipientEmail = registeredUser.email;
        recipientName = registeredUser.firstName;
      }
    }

    if (recipientEmail) {
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const orderLink = req.user
        ? `${clientUrl}/order-confirmation/${order.id}`
        : `${clientUrl}/order-confirmation/${order.id}?email=${encodeURIComponent(recipientEmail)}`;

      sendOrderConfirmationEmail(recipientEmail, {
        name: recipientName,
        orderId: order.id,
        orderLink,
        items: order.items.map((i) => ({ productName: i.productName, price: Number(i.price), quantity: i.quantity })),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        couponCode: order.couponCode,
        total: Number(order.total),
        shippingAddress: order.shippingAddress,
      });
    }
  } catch (err: any) {
    if (err.statusCode === 409) {
      return res.status(409).json({ message: err.message, issues: err.issues });
    }

    if (err instanceof CouponError) {
      return res.status(400).json({ message: err.message });
    }

    // Race condition: two requests with the same idempotency key both passed the
    // up-front lookup before either had committed. Postgres' unique constraint on
    // idempotencyKey rejects the second insert (error code 23505) — rather than
    // surfacing that as a 500, treat it exactly like a normal idempotent replay
    // and hand back whichever order won the race.
    if (idempotencyKey && err.code === "23505" && String(err.detail || "").includes("idempotencyKey")) {
      const winner = await orderRepo().findOne({ where: { idempotencyKey }, relations: ["items"] });
      if (winner) return res.status(200).json(winner);
    }

    console.error("Order creation failed:", err);
    res.status(500).json({ message: "Failed to place order" });
  }
});

// Guest order tracking: look up a single order by id + the email used at checkout.
// Only works for guest orders (guestEmail set) — registered-user orders stay private to their account.
router.get("/track/:id", validateUuidParam(), async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().slice(0, 254) : undefined;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const order = await orderRepo().findOne({ where: { id: req.params.id }, relations: ["items"] });
  if (!order || !order.guestEmail || order.guestEmail.toLowerCase() !== email.toLowerCase()) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json(order);
});

// super_admin: can update any order's status.
// admin: can only update status if EVERY item in the order belongs to their shop
//        (a mixed-shop order needs a super_admin, or you'd want per-item fulfillment status later).
router.patch("/:id/status", validateUuidParam(), requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const schema = z.object({
    status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid status" });

  const order = await orderRepo().findOne({ where: { id: req.params.id }, relations: ["items"] });
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (req.user!.role === "admin") {
    const allMine = order.items.every((i) => i.shopId === req.shopId);
    if (!allMine) {
      return res.status(403).json({ message: "This order includes items from other shops — a super admin must update it" });
    }
  }

  const oldStatus = order.status;
  const newStatus = parsed.data.status;
  if (oldStatus === newStatus) {
    return res.json(order); // no-op, nothing to reconcile
  }

  const enteringCancelled = newStatus === "cancelled" && oldStatus !== "cancelled";
  const leavingCancelled = oldStatus === "cancelled" && newStatus !== "cancelled";

  try {
    const updated = await AppDataSource.transaction(async (manager) => {
      const txProductRepo = manager.getRepository(Product);

      if (enteringCancelled) {
        // Give the reserved stock back — otherwise a cancelled order
        // permanently shrinks the product's available inventory for no reason.
        for (const item of order.items) {
          if (!item.productId) continue; // product was deleted since the order was placed — nothing to restock
          const product = await txProductRepo.findOne({ where: { id: item.productId } });
          if (product) {
            product.stock += item.quantity;
            await txProductRepo.save(product);
          }
        }
      } else if (leavingCancelled) {
        // Re-activating a previously cancelled order (e.g. an admin correcting
        // a mistaken cancellation) needs to re-reserve that stock — but it may
        // no longer be available if other orders consumed it in the meantime,
        // so this re-validates rather than allowing stock to go negative.
        const issues: { productId: string; productName?: string; availableStock: number; requestedQuantity: number }[] = [];
        const productsToUpdate: { product: Product; quantity: number }[] = [];

        for (const item of order.items) {
          if (!item.productId) continue;
          const product = await txProductRepo.findOne({ where: { id: item.productId } });
          if (!product || product.stock < item.quantity) {
            issues.push({
              productId: item.productId,
              productName: item.productName,
              availableStock: product?.stock ?? 0,
              requestedQuantity: item.quantity,
            });
            continue;
          }
          productsToUpdate.push({ product, quantity: item.quantity });
        }

        if (issues.length > 0) {
          const err: any = new Error("Can't reactivate this order — some items no longer have enough stock");
          err.statusCode = 409;
          err.issues = issues;
          throw err;
        }

        for (const { product, quantity } of productsToUpdate) {
          product.stock -= quantity;
          await txProductRepo.save(product);
        }
      }

      order.status = newStatus;
      return manager.getRepository(Order).save(order);
    });

    res.json(updated);
  } catch (err: any) {
    if (err.statusCode === 409) {
      return res.status(409).json({ message: err.message, issues: err.issues });
    }
    console.error("Order status update failed:", err);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

export default router;
