import { Router } from "express";
import { z } from "zod";
import { FindOptionsWhere } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { CLOSED_STATUSES, COUNTED_SALE_SQL, Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { CallOutcome, OrderCall } from "../entities/OrderCall";
import { isPhoneBlocked, riskByPhone } from "../services/customerRisk";
import { codOtpMinTotal } from "../services/sms";
import { consumePhoneCode, verifyPhoneCode } from "../services/phoneVerification";
import {
  requireAuth,
  requireAnyAdmin,
  attachShop,
  optionalAuth,
} from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { addressSchema, algerianPhoneSchema } from "../utils/validators";
import type { CancelReason } from "../emails/orderEmails";
import { requestLocale } from "../utils/locale";
import { availablePaymentMethods, quoteShipping } from "../services/shipping";
import { HttpError, invalidCommune, StockIssue, stockConflict } from "../utils/httpError";
import { findCommune } from "../services/communes";
import { applyStockChanges, LowStockAlert, lockStock, mergeLines, unitPrice } from "../services/inventory";
import { paginated, parsePagination } from "../utils/pagination";
import * as notifications from "../services/notifications";
import { audit } from "../services/audit";
import { createShipments, rollUpStatus, shipmentsOf } from "../services/fulfilment";
import { commissionPercent } from "../services/payouts";
import { applyCouponWithLock } from "../services/coupons";
import { expireChargilyCheckout } from "../services/chargily";
import {
  loadOrderForUpdate,
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
  "returned",
] as const;
const statusFilterSchema = z.enum(ORDER_STATUSES).optional();

// Admins see each customer's delivery history (orders / delivered / returned /
// refused, blocked or not) next to the order, to spot risky COD orders.
async function withCustomerRisk<T extends Pick<Order, "phone">>(orders: T[]) {
  const risk = await riskByPhone(orders.map((o) => o.phone));
  return orders.map((o) => ({ ...o, customerRisk: (o.phone && risk.get(o.phone)) || null }));
}

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
    return res.json(paginated(await withCustomerRisk(items), total, pageParams));
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
  const body = role === "customer" ? items : await withCustomerRisk(items);
  res.json(paginated(body, total, pageParams));
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
    const paidRevenue = COUNTED_SALE_SQL;
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
      relations: ["items", "user", "shipments", "shipments.shop", "calls"],
      order: { calls: { createdAt: "DESC" } },
    });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const role = req.user!.role;
    if (role === "customer") {
      if (order.userId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
      const { calls: _internal, ...forCustomer } = order; // call notes are staff-only
      return res.json(forCustomer);
    }

    let view: Order = order;
    if (role === "admin") {
      const myItems = order.items.filter((i) => i.shopId === req.shopId);
      if (myItems.length === 0)
        return res.status(403).json({ message: "Forbidden" });
      view = Object.assign(new Order(), order, {
        items: myItems,
        shipments: order.shipments?.filter((s) => s.shopId === req.shopId),
      });
    }
    const [withHistory] = await withCustomerRisk([view]);
    res.json(withHistory);
  },
);

const createOrderSchema = z.object({
  paymentMethod: z.enum(["card", "cod"]).default("card"),
  // Delivery details — couriers need a reachable mobile number for every order.
  phone: algerianPhoneSchema,
  wilayaCode: z.number().int().min(1).max(99),
  commune: z.string().trim().min(1).max(100),
  deliveryType: z.enum(["home", "desk"]).default("home"),
  // SMS code, when large pay-on-delivery orders require one (services/sms.ts).
  phoneCode: z.string().trim().regex(/^\d{6}$/).optional(),
  shippingAddress: addressSchema,
  guestEmail: z.string().trim().toLowerCase().email().max(254).optional(), // required if not logged in
  guestName: z.string().trim().min(1).max(80).optional(), // used to personalize the confirmation email
  couponCode: z.string().trim().min(1).max(30).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        // Required when the product has options (size, colour...).
        variantId: z.string().uuid().nullish(),
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
    phoneCode,
  } = parsed.data;
  const userId = req.user?.id;

  // Couriers need an exact commune; it's stored with its official spelling.
  const matchedCommune = findCommune(wilayaCode, commune);
  if (!matchedCommune) throw invalidCommune();

  if (!availablePaymentMethods().includes(paymentMethod)) {
    return res
      .status(400)
      .json({ message: "Online payment isn't available — choose pay on delivery" });
  }

  if (paymentMethod === "cod" && (await isPhoneBlocked(phone))) {
    return res.status(400).json({
      code: "COD_BLOCKED",
      message: "Pay on delivery isn't available for this phone number — please pay online or contact us.",
    });
  }

  // Checked before the order transaction so wrong guesses are counted even
  // when the checkout then fails.
  let verifiedCodeId: string | null = null;
  if (phoneCode) {
    verifiedCodeId = await verifyPhoneCode(phone, phoneCode);
    if (!verifiedCodeId) {
      return res.status(400).json({
        code: "PHONE_CODE_INVALID",
        message: "That code is wrong or has expired — ask for a new one",
      });
    }
  }
  const otpMinTotal = paymentMethod === "cod" ? codOtpMinTotal() : null;

  if (!userId && !guestEmail) {
    return res
      .status(400)
      .json({ message: "An email is required to check out as a guest" });
  }

  const lines = mergeLines(parsed.data.items);

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
  let lowStock: LowStockAlert[] = [];
  try {
    order = await AppDataSource.transaction(async (manager) => {
      const shipping = await quoteShipping(manager, wilayaCode, deliveryType);
      const stock = await lockStock(manager, lines.map((l) => l.productId));

      // Validate every line before touching anything.
      const issues: StockIssue[] = [];
      for (const line of lines) {
        const product = stock.products.get(line.productId);
        if (product && !line.variantId && stock.hasVariants(product.id)) {
          throw new HttpError(400, `Choose an option for ${product.name}`, {
            code: "VARIANT_REQUIRED",
            productId: product.id,
          });
        }
        if (stock.available(line) < line.quantity) issues.push(stock.issue(line));
      }
      if (issues.length > 0) {
        throw stockConflict(
          "Some items are no longer available in the requested quantity",
          issues,
        );
      }

      const orderItems: OrderItem[] = [];
      let subtotal = 0;
      for (const line of lines) {
        const product = stock.products.get(line.productId)!;
        const variant = line.variantId ? stock.variant(product.id, line.variantId)! : null;
        const price = unitPrice(product, variant);
        const orderItem = new OrderItem();
        orderItem.productId = product.id;
        orderItem.shopId = product.shopId;
        orderItem.productName = product.name;
        orderItem.variantId = variant?.id ?? null;
        orderItem.variantName = variant?.name ?? null;
        orderItem.price = price;
        orderItem.quantity = line.quantity;
        orderItem.commissionRate = commissionPercent();
        orderItems.push(orderItem);
        subtotal += price * line.quantity;
      }
      lowStock = await applyStockChanges(
        manager,
        stock,
        lines.map((l) => ({ ...l, delta: -l.quantity })),
      );

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

      const total = subtotal - discountAmount + shipping.fee;
      if (otpMinTotal !== null && total >= otpMinTotal) {
        if (!verifiedCodeId) {
          throw new HttpError(400, "Confirm your phone number with the code we text you", {
            code: "PHONE_CODE_REQUIRED",
          });
        }
        await consumePhoneCode(manager, verifiedCodeId);
      }

      const newOrder = manager.getRepository(Order).create({
        userId,
        guestEmail: userId ? undefined : guestEmail,
        guestName: userId ? undefined : guestName,
        shippingAddress,
        phone,
        wilayaCode,
        wilayaName: shipping.zone.name,
        commune: matchedCommune.name,
        deliveryType,
        paymentMethod,
        subtotal,
        discountAmount,
        couponCode: appliedCouponCode,
        couponShopId,
        shippingFee: shipping.fee,
        total,
        status: "pending",
        // Card orders hold stock only until this deadline unless paid; pay-on-
        // delivery orders hold it until an admin confirms or cancels them.
        reservedUntil: paymentMethod === "card" ? reservationDeadline() : null,
        items: orderItems,
        idempotencyKey,
        locale: requestLocale(req),
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
  if (lowStock.length > 0) {
    notifications.inBackground(notifications.notifyLowStock(lowStock), {
      orderId: order.id,
    });
  }
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

// Guests prove the order is theirs with the email used at checkout.
const cancelSchema = z.object({ email: z.string().trim().max(254).optional() });
const CANCELLABLE: OrderStatus[] = ["pending", "processing"];

// A customer cancels their own order while nothing has shipped yet; stock and
// coupon use are released. An order already paid online needs a refund, so
// those go through the shop team instead.
router.post("/:id/cancel", validateUuidParam(), optionalAuth, async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
  const email = parsed.data.email?.toLowerCase();

  let changed = false;
  const order = await AppDataSource.transaction(async (manager) => {
    const order = await loadOrderForUpdate(manager, req.params.id);
    const owns =
      order &&
      (order.userId
        ? order.userId === req.user?.id
        : !!email && order.guestEmail?.toLowerCase() === email);
    if (!order || !owns) throw new HttpError(404, "Order not found");
    if (order.status === "cancelled") return order; // already done

    const shipments = await shipmentsOf(manager, order);
    if (!CANCELLABLE.includes(order.status) || shipments.some((s) => !CANCELLABLE.includes(s.status))) {
      throw new HttpError(409, "This order has already shipped — you can refuse the parcel, or contact us", {
        code: "CANCEL_TOO_LATE",
      });
    }
    if (order.paymentMethod === "card" && order.paymentStatus === "paid") {
      throw new HttpError(409, "This order is already paid — contact us to cancel it and get a refund", {
        code: "CANCEL_NEEDS_REFUND",
      });
    }

    await setOrderStatus(manager, order, "cancelled");
    await manager.getRepository(Order).update(order.id, { cancelledBy: "customer" });
    order.cancelledBy = "customer";
    changed = true;
    return order;
  });

  res.json(order);
  if (changed) {
    notifications.inBackground(notifications.notifyCustomerCancelled(order.id), { orderId: order.id });
    // An unpaid card order may still have a payment page open: close it so
    // the customer can't pay for what they just cancelled. (If a payment
    // slips through anyway, the webhook keeps the order cancelled.)
    if (order.paymentMethod === "card" && order.paymentCheckoutId) {
      notifications.inBackground(expireChargilyCheckout(order.paymentCheckoutId), { orderId: order.id });
    }
  }
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  // Only used when marking an order "returned".
  returnReason: z.string().trim().max(200).optional(),
  returnCost: z.number().min(0).max(100_000).optional(),
});

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

      if (newStatus === "returned" && !["shipped", "delivered", "returned"].includes(order.status)) {
        throw new HttpError(400, "Only a shipped order can be marked returned — cancel it instead");
      }

      previousStatus = order.status;
      const updated = await setOrderStatus(manager, order, newStatus);
      if (newStatus === "returned" && previousStatus !== "returned") {
        const returnInfo = {
          returnedAt: new Date(),
          returnReason: parsed.data.returnReason || null,
          returnCost: parsed.data.returnCost ?? 0,
        };
        await manager.getRepository(Order).update(order.id, returnInfo);
        Object.assign(updated, returnInfo);
      }
      return updated;
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
      if (CLOSED_STATUSES.includes(order.status)) throw new HttpError(400, `This order was ${order.status}`);
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

const callSchema = z.object({
  outcome: z.enum(["confirmed", "no_answer", "declined", "wrong_number"]),
  note: z.string().trim().max(300).optional(),
});

const CALL_CANCEL_REASON: Partial<Record<CallOutcome, CancelReason>> = {
  declined: "declined",
  wrong_number: "wrongNumber",
};

// Logs a confirmation call for a pay-on-delivery order awaiting confirmation:
//   confirmed → order moves to "processing" (customer emailed)
//   no_answer → counted in callAttempts, order stays pending
//   declined / wrong_number → order cancelled and restocked
router.post(
  "/:id/calls",
  validateUuidParam(),
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const parsed = callSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const { outcome, note } = parsed.data;

    let previousStatus: OrderStatus | undefined;
    const { order, call } = await AppDataSource.transaction(async (manager) => {
      const order = await loadOrderForUpdate(manager, req.params.id);
      if (!order) throw new HttpError(404, "Order not found");
      // Confirming or cancelling moves the whole order, so (as for /status) a
      // shop admin may only do it when every item is theirs.
      if (req.user!.role === "admin" && !order.items.every((i) => i.shopId === req.shopId)) {
        throw new HttpError(
          403,
          "This order includes items from other shops — a super admin must confirm it",
        );
      }
      if (order.paymentMethod !== "cod" || order.status !== "pending") {
        throw new HttpError(400, "Only pay-on-delivery orders awaiting confirmation can be confirmed by phone");
      }

      const call = await manager.getRepository(OrderCall).save(
        manager.getRepository(OrderCall).create({
          orderId: order.id,
          outcome,
          note: note || null,
          createdById: req.user!.id,
        }),
      );
      previousStatus = order.status;

      if (outcome === "confirmed") {
        const confirmedAt = new Date();
        await manager.getRepository(Order).update(order.id, { confirmedAt });
        order.confirmedAt = confirmedAt;
        await setOrderStatus(manager, order, "processing");
      } else if (outcome === "no_answer") {
        await manager.getRepository(Order).increment({ id: order.id }, "callAttempts", 1);
        order.callAttempts += 1;
      } else {
        await setOrderStatus(manager, order, "cancelled");
      }
      return { order, call };
    });

    void audit(req, "order.call", "order", order.id, { outcome, note });
    res.status(201).json({
      call,
      order: {
        id: order.id,
        status: order.status,
        callAttempts: order.callAttempts,
        confirmedAt: order.confirmedAt,
      },
    });
    if (previousStatus !== order.status) {
      notifications.inBackground(
        notifications.notifyStatusChange(order.id, order.status, CALL_CANCEL_REASON[outcome]),
        { orderId: order.id, status: order.status },
      );
    }
  },
);

export default router;
