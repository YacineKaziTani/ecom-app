import "reflect-metadata";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { sanitizeBody } from "./middleware/sanitize";
import { apiLimiter } from "./middleware/rateLimit";

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

export const app = express();

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

app.use(
  "/api/payments/webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  paymentWebhookRoutes,
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use("/api", apiLimiter);

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

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
