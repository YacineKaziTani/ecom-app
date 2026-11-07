import { Router } from "express";
import { z } from "zod";
import { FindOptionsWhere } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import {
  requireAuth,
  requireAnyAdmin,
  attachShop,
  optionalAuth,
} from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { addressSchema, algerianPhoneSchema } from "../utils/validators";
import { availablePaymentMethods, quoteShipping } from "../services/shipping";
import { HttpError, StockIssue, stockConflict } from "../utils/httpError";
import { paginated, parsePagination } from "../utils/pagination";
import * as notifications from "../services/notifications";
import { audit } from "../services/audit";
import { createShipments, rollUpStatus, shipmentsOf } from "../services/fulfilment";
import { commissionPercent } from "../services/payouts";
import { applyCouponWithLock } from "../services/coupons";
import {
  loadOrderForUpdate,
  lockProducts,
  reservationDeadline,
  setOrderStatus,
} from "../services/orderLifecycle";

const router = Router();
const orderRepo = () => AppDataSource.getRepository(Order);


const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
const statusFilterSchema = z.enum(ORDER_STATUSES).optional();

// Paginated order list, scoped by role:
//   customer    → their own orders
//   super_admin → every order
//   admin       → orders containing at least one of their shop's items, with
//                 `items` narrowed down to just their own lines
// Optional ?status= filter.
router.get("/", requireAuth, attachShop, async (req, res) => {
  const pageParams = parsePagination(req.query);
  const status = statusFilterSchema.safeParse(req.query.status || undefined);
  if (!status.success)
    return res.status(400).json({ message: "Invalid status filter" });

  const role = req.user!.role;

  if (role === "admin") {
    const qb = orderRepo()
      .createQueryBuilder("order")
      .innerJoinAndSelect("order.items", "item", "item.shopId = :shopId", {
        shopId: req.shopId,
      })
      .leftJoinAndSelect("order.user", "user")
      // Separate parameter: order_items.shopId is text, shipments.shopId is uuid.
      .leftJoinAndSelect("order.shipments", "shipment", "shipment.shopId = :shipmentShopId", {
        shipmentShopId: req.shopId,
      })
      .orderBy("order.createdAt", "DESC")
      .skip(pageParams.skip)
      .take(pageParams.limit);
    if (status.data) qb.andWhere("order.status = :status", { status: status.data });
    const [items, total] = await qb.getManyAndCount();
    return res.json(paginated(items, total, pageParams));
  }

  const where: FindOptionsWhere<Order> = {};
  if (role === "customer") where.userId = req.user!.id;
  if (status.data) where.status = status.data;

  const [items, total] = await orderRepo().findAndCount({
    where,
    relations: ["items", "user", "shipments", "shipments.shop"],
    order: { createdAt: "DESC" },
    skip: pageParams.skip,
    take: pageParams.limit,
  });
  res.json(paginated(items, total, pageParams));
});

// Dashboard headline numbers, computed in SQL so the overview never has to
// download every order. Revenue counts paid, non-cancelled orders only (a shop
// admin's revenue is the sum of their own lines, as everywhere else).
router.get(
  "/summary",
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const paidRevenue = `o."paymentStatus" = 'paid' AND o.status <> 'cancelled'`;
    const [row] =
      req.user!.role === "super_admin"
        ? await AppDataSource.query(
            `SELECT COUNT(*) AS "totalOrders",
                    COUNT(*) FILTER (WHERE o.status = 'pending') AS "pendingOrders",
                    COALESCE(SUM(o.total) FILTER (WHERE ${paidRevenue}), 0) AS revenue
             FROM orders o`,
          )
        : await AppDataSource.query(
            `SELECT COUNT(DISTINCT o.id) AS "totalOrders",
                    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'pending') AS "pendingOrders",
                    COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE ${paidRevenue}), 0) AS revenue
             FROM orders o
             JOIN order_items oi ON oi."orderId" = o.id
             WHERE oi."shopId" = $1`,
            [req.shopId],
          );

    res.json({
      totalOrders: Number(row.totalOrders),
      pendingOrders: Number(row.pendingOrders),
      revenue: Number(row.revenue),
    });
  },
);

router.get(
  "/:id",
  validateUuidParam(),
  requireAuth,
  attachShop,
  async (req, res) => {
    const order = await orderRepo().findOne({
      where: { id: req.params.id },
      relations: ["items", "user", "shipments", "shipments.shop"],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const role = req.user!.role;
    if (role === "customer" && order.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (role === "admin") {
      const myItems = order.items.filter((i) => i.shopId === req.shopId);
      if (myItems.length === 0)
        return res.status(403).json({ message: "Forbidden" });
      return res.json({
        ...order,
        items: myItems,
        shipments: order.shipments?.filter((s) => s.shopId === req.shopId),
      });
    }

    res.json(order);
  },
);

const createOrderSchema = z.object({
  paymentMethod: z.enum(["card", "cod"]).default("card"),
  // Delivery details — couriers need a reachable mobile number for every order.
  phone: algerianPhoneSchema,
  wilayaCode: z.number().int().min(1).max(99),
  commune: z.string().trim().min(1).max(100),
  deliveryType: z.enum(["home", "desk"]).default("home"),
  shippingAddress: addressSchema,
  guestEmail: z.string().trim().toLowerCase().email().max(254).optional(), // required if not logged in
  guestName: z.string().trim().min(1).max(80).optional(), // used to personalize the confirmation email
  couponCode: z.string().trim().min(1).max(30).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1)
    .max(50),
});

router.post("/", optionalAuth, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const {
    shippingAddress,
    guestEmail,
    guestName,
    couponCode,
    paymentMethod,
    phone,
    wilayaCode,
    commune,
    deliveryType,
  } = parsed.data;
  const userId = req.user?.id;

  if (!availablePaymentMethods().includes(paymentMethod)) {
    return res
      .status(400)
      .json({ message: "Online payment isn't available — choose pay on delivery" });
  }

  if (!userId && !guestEmail) {
    return res
      .status(400)
      .json({ message: "An email is required to check out as a guest" });
  }

  // The same product listed twice must be checked against stock as one line,
  // otherwise each line passes the check on its own and stock goes negative.
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of parsed.data.items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  // Optional client-supplied key so a retried request (network timeout, a
  // double-click that slipped past the disabled button, etc.) returns the
  // SAME order instead of creating a duplicate. Cap the length defensively —
  // this only ever needs to hold a UUID-sized value.
  const idempotencyKey = req.header("Idempotency-Key")?.slice(0, 200);
  const findByIdempotencyKey = () =>
    orderRepo().findOne({ where: { idempotencyKey }, relations: ["items"] });

  if (idempotencyKey) {
    const existing = await findByIdempotencyKey();
    if (existing) return res.status(200).json(existing);
  }

  let order: Order;
  try {
    order = await AppDataSource.transaction(async (manager) => {
      const shipping = await quoteShipping(manager, wilayaCode, deliveryType);
      const products = await lockProducts(manager, [...quantities.keys()]);

      // Validate every line before touching anything.
      const issues: StockIssue[] = [];
      for (const [productId, quantity] of quantities) {
        const product = products.get(productId);
        if (!product || product.stock < quantity) {
          issues.push({
            productId,
            productName: product?.name,
            availableStock: product?.stock ?? 0,
            requestedQuantity: quantity,
          });
        }
      }
      if (issues.length > 0) {
        throw stockConflict(
          "Some items are no longer available in the requested quantity",
          issues,
        );
      }

      const orderItems: OrderItem[] = [];
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        const product = products.get(productId)!;
        const orderItem = new OrderItem();
        orderItem.productId = product.id;
        orderItem.shopId = product.shopId;
        orderItem.productName = product.name;
        orderItem.price = product.price;
        orderItem.quantity = quantity;
        orderItem.commissionRate = commissionPercent();
        orderItems.push(orderItem);
        subtotal += Number(product.price) * quantity;

        product.stock -= quantity;
        await manager.save(product);
      }

      let discountAmount = 0;
      let appliedCouponCode: string | undefined;
      let couponShopId: string | null = null;
      if (couponCode) {
        const result = await applyCouponWithLock(
          manager,
          couponCode,
          subtotal,
          orderItems.map((i) => i.shopId!),
        );
        discountAmount = result.discountAmount;
        appliedCouponCode = result.coupon.code;
        couponShopId = result.coupon.shopId ?? null;
      }

      const newOrder = manager.getRepository(Order).create({
        userId,
        guestEmail: userId ? undefined : guestEmail,
        guestName: userId ? undefined : guestName,
        shippingAddress,
        phone,
        wilayaCode,
        wilayaName: shipping.zone.name,
        commune,
        deliveryType,
        paymentMethod,
        subtotal,
        discountAmount,
        couponCode: appliedCouponCode,
        couponShopId,
        shippingFee: shipping.fee,
        total: subtotal - discountAmount + shipping.fee,
        status: "pending",
        // Card orders hold stock only until this deadline unless paid; pay-on-
        // delivery orders hold it until an admin confirms or cancels them.
        reservedUntil: paymentMethod === "card" ? reservationDeadline() : null,
        items: orderItems,
        idempotencyKey,
      });
      const saved = await manager.getRepository(Order).save(newOrder);
      // Each shop fulfils (and tracks) its own part of the order.
      await createShipments(manager, saved.id, orderItems.map((i) => i.shopId!));
      return saved;
    });
  } catch (err: any) {
    // Two requests with the same key raced past the lookup above; the unique
    // constraint let only one insert win — return that one.
    if (
      idempotencyKey &&
      err?.code === "23505" &&
      String(err.detail || "").includes("idempotencyKey")
    ) {
      const winner = await findByIdempotencyKey();
      if (winner) return res.status(200).json(winner);
    }
    throw err; // stock conflicts / coupon errors / anything else → global error handler
  }

  res.status(201).json(order);

  // After responding, so email latency or failure never affects checkout.
  notifications.inBackground(notifications.notifyOrderPlaced(order.id), {
    orderId: order.id,
  });
});

// Public guest lookup: order id + the email used at checkout. Registered
// customers' orders are never exposed here.
router.get("/track/:id", validateUuidParam(), async (req, res) => {
  const email =
    typeof req.query.email === "string"
      ? req.query.email.trim().slice(0, 254)
      : undefined;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const order = await orderRepo().findOne({
    where: { id: req.params.id },
    relations: ["items", "shipments", "shipments.shop"],
  });
  if (
    !order ||
    !order.guestEmail ||
    order.guestEmail.toLowerCase() !== email.toLowerCase()
  ) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json(order);
});

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

router.patch(
  "/:id/status",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid status" });
    const newStatus: OrderStatus = parsed.data.status;

    let previousStatus: OrderStatus | undefined;
    const updated = await AppDataSource.transaction(async (manager) => {
      const order = await loadOrderForUpdate(manager, req.params.id);
      if (!order) throw new HttpError(404, "Order not found");

      if (
        req.user!.role === "admin" &&
        !order.items.every((i) => i.shopId === req.shopId)
      ) {
        throw new HttpError(
          403,
          "This order includes items from other shops — a super admin must update it",
        );
      }

      previousStatus = order.status;
      return setOrderStatus(manager, order, newStatus);
    });

    res.json(updated);
    if (previousStatus !== newStatus) {
      void audit(req, "order.status_change", "order", updated.id, { from: previousStatus, to: newStatus });
      notifications.inBackground(
        notifications.notifyStatusChange(updated.id, newStatus),
        { orderId: updated.id, status: newStatus },
      );
    }
  },
);

const shipmentUpdateSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered"]).optional(),
  carrier: z.string().trim().max(60).nullable().optional(),
  trackingNumber: z.string().trim().max(80).nullable().optional(),
});

// A shop updates its own part of an order (status, carrier, tracking number);
// a super admin can update any shop's part. The order's status follows the
// slowest shipment. Cancelling stays an order-level action (it restocks).
router.patch(
  "/:id/shipments/:shopId",
  validateUuidParam(),
  validateUuidParam("shopId"),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const parsed = shipmentUpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    if (req.user!.role === "admin" && req.params.shopId !== req.shopId) {
      return res.status(403).json({ message: "You can only update your own shop's shipment" });
    }

    let previousStatus: OrderStatus | undefined;
    const { order, shipment } = await AppDataSource.transaction(async (manager) => {
      const order = await loadOrderForUpdate(manager, req.params.id);
      if (!order) throw new HttpError(404, "Order not found");
      if (order.status === "cancelled") throw new HttpError(400, "This order was cancelled");
      if (
        parsed.data.status &&
        order.paymentMethod === "card" &&
        order.paymentStatus !== "paid"
      ) {
        throw new HttpError(400, "Wait until the order is paid before fulfilling it");
      }

      const shipments = await shipmentsOf(manager, order);
      const shipment = shipments.find((s) => s.shopId === req.params.shopId);
      if (!shipment) throw new HttpError(404, "This order has nothing from that shop");
      Object.assign(shipment, parsed.data);
      await manager.save(shipment);

      previousStatus = order.status;
      const rolledUp = rollUpStatus(shipments.map((s) => s.status));
      if (rolledUp !== order.status) {
        await setOrderStatus(manager, order, rolledUp, { syncShipments: false });
      }
      return { order, shipment };
    });

    void audit(req, "order.shipment_update", "order", order.id, {
      shopId: req.params.shopId,
      ...parsed.data,
    });
    res.json({
      shipment,
      order: { id: order.id, status: order.status, paymentStatus: order.paymentStatus },
    });
    if (previousStatus !== order.status) {
      notifications.inBackground(
        notifications.notifyStatusChange(order.id, order.status),
        { orderId: order.id, status: order.status },
      );
    }
  },
);

export default router;
