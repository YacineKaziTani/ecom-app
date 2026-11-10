import "reflect-metadata";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { AppDataSource } from "./config/data-source";
import { logger } from "./config/logger";
import { sanitizeBody } from "./middleware/sanitize";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth";
import shopRoutes from "./routes/shops";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import orderRoutes from "./routes/orders";
import uploadRoutes from "./routes/upload";
import paymentRoutes from "./routes/payments";
import paymentWebhookRoutes from "./routes/paymentWebhook";
import couponRoutes from "./routes/coupons";
import analyticsRoutes from "./routes/analytics";
import cartRoutes from "./routes/cart";
import shippingRoutes from "./routes/shipping";
import payoutRoutes from "./routes/payouts";
import twoFactorRoutes from "./routes/twoFactor";
import sellerApplicationRoutes from "./routes/sellerApplications";
import auditLogRoutes from "./routes/auditLogs";
import reviewRoutes from "./routes/reviews";
import wishlistRoutes from "./routes/wishlist";
import seoRoutes from "./routes/seo";
import blockedPhoneRoutes from "./routes/blockedPhones";
import phoneVerificationRoutes from "./routes/phoneVerifications";
import addressRoutes from "./routes/addresses";
import { codOtpMinTotal } from "./services/sms";
import { availablePaymentMethods } from "./services/shipping";
import { RESERVATION_MINUTES } from "./services/orderLifecycle";

export const app = express();

// Behind Render (and the Vercel /api rewrite) the TCP peer is a proxy, so
// without this req.ip — which every rate limiter keys on — is the proxy's
// address and all visitors share one limit. TRUST_PROXY = number of proxy hops
// in front of the app (Render alone: 1; Vercel rewrite → Render: 2).
const trustProxy =
  process.env.TRUST_PROXY ??
  (process.env.NODE_ENV === "production" ? "1" : undefined);
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(
  pinoHttp({
    logger,
    // Reuse an incoming X-Request-Id (from a proxy) or mint one; it's echoed
    // back so a user-reported error can be matched to its log lines.
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && /^[\w-]{1,100}$/.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === "/api/health" },
    customLogLevel: (_req, res, err) =>
      err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    serializers: {
      // Path only: query strings can carry emails (e.g. /orders/track?email=).
      req: (req) => ({ id: req.id, method: req.method, path: req.url?.split("?")[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// For uptime monitors and the platform's health check: 503 when the database
// is unreachable. `ip` shows the client address as the app sees it — open this
// through the production URL to confirm TRUST_PROXY is right.
app.get("/api/health", async (req, res) => {
  try {
    await AppDataSource.query("SELECT 1");
    res.json({ status: "ok", db: "up", ip: req.ip });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.use(
  "/api/payments/webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  paymentWebhookRoutes,
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use("/api", apiLimiter);

app.use("/api/auth/2fa", twoFactorRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/seller-applications", sellerApplicationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/seo", seoRoutes);
app.use("/api/blocked-phones", blockedPhoneRoutes);
app.use("/api/phone-verifications", phoneVerificationRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api", reviewRoutes); // /products/:id/reviews, /reviews/:id

// Public storefront configuration the checkout needs.
app.get("/api/config", (_req, res) => {
  res.json({
    paymentMethods: availablePaymentMethods(),
    reservationMinutes: RESERVATION_MINUTES,
    // Pay-on-delivery orders at or above this total need an SMS code (null = off).
    codOtpMinTotal: codOtpMinTotal(),
  });
});

app.use("/api", notFoundHandler);
app.use(errorHandler);
