import { Sentry } from "../config/sentry";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { StockAlert } from "../entities/StockAlert";
import { User } from "../entities/User";
import { backInStockEmail } from "../emails/stockEmails";
import { isLocale } from "../emails/i18n";
import * as mailer from "./email";
import { track } from "../utils/background";
import { HttpError } from "../utils/httpError";

const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";
const BATCH = 200;

// Signs an email up for a sold-out product (or option). Signing up twice is
// harmless; something in stock is refused (just buy it).
export async function subscribeToStockAlert(input: {
  productId: string;
  variantId: string | null;
  email?: string;
  userId?: string;
  locale: string;
}): Promise<void> {
  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: input.productId },
    select: { id: true, stock: true },
  });
  if (!product) throw new HttpError(404, "Product not found");

  let stock = product.stock;
  if (input.variantId) {
    const variant = await AppDataSource.getRepository(ProductVariant).findOne({
      where: { id: input.variantId, productId: product.id },
      select: { id: true, stock: true },
    });
    if (!variant) throw new HttpError(400, "Unknown option");
    stock = variant.stock;
  }
  if (stock > 0) throw new HttpError(409, "It's in stock — you can order it now", { code: "IN_STOCK" });

  // A signed-in customer is told at their account address.
  const email = input.userId
    ? (await AppDataSource.getRepository(User).findOne({ where: { id: input.userId }, select: { email: true } }))?.email
    : input.email;
  if (!email) throw new HttpError(400, "Enter your email address");

  await AppDataSource.createQueryBuilder()
    .insert()
    .into(StockAlert)
    .values({
      productId: product.id,
      variantId: input.variantId,
      email: email.toLowerCase(),
      locale: isLocale(input.locale) ? input.locale : "en",
    })
    .orIgnore() // already waiting (UQ_stock_alerts_pending)
    .execute();
}

// Emails everyone waiting for something that's in stock again (optionally
// only for some products). Each alert is claimed before its email goes out,
// so concurrent runs never send it twice. Returns how many were sent.
export async function sendBackInStockAlerts(productIds?: string[]): Promise<number> {
  if (productIds && productIds.length === 0) return 0;
  const ready: { id: string }[] = await AppDataSource.query(
    `SELECT a.id
     FROM stock_alerts a
     JOIN products p ON p.id = a."productId"
     LEFT JOIN product_variants v ON v.id = a."variantId"
     WHERE a."notifiedAt" IS NULL
       AND CASE WHEN a."variantId" IS NULL THEN p.stock > 0 ELSE COALESCE(v.stock, 0) > 0 END
       ${productIds ? `AND a."productId" = ANY($1)` : ""}
     ORDER BY a."createdAt"
     LIMIT ${BATCH}`,
    productIds ? [productIds] : [],
  );
  if (ready.length === 0) return 0;

  // UPDATE … RETURNING comes back as [rows, affected count].
  const [claimed]: [{ id: string; email: string; locale: string; productId: string; variantId: string | null }[], number] =
    await AppDataSource.query(
      `UPDATE stock_alerts SET "notifiedAt" = now()
       WHERE id = ANY($1) AND "notifiedAt" IS NULL
       RETURNING id, email, locale, "productId", "variantId"`,
      [ready.map((r) => r.id)],
    );
  const productNames = new Map(
    (
      await AppDataSource.getRepository(Product).find({
        where: { id: In([...new Set(claimed.map((a) => a.productId))]) },
        select: { id: true, name: true },
      })
    ).map((p) => [p.id, p.name]),
  );
  const variantIds = [...new Set(claimed.map((a) => a.variantId).filter((id): id is string => !!id))];
  const variantNames = new Map(
    variantIds.length
      ? (
          await AppDataSource.getRepository(ProductVariant).find({ where: { id: In(variantIds) }, select: { id: true, name: true } })
        ).map((v) => [v.id, v.name])
      : [],
  );

  let sent = 0;
  for (const alert of claimed) {
    const productName = productNames.get(alert.productId) ?? "";
    const variantName = alert.variantId ? variantNames.get(alert.variantId) : undefined;
    const name = variantName ? `${productName} — ${variantName}` : productName;
    const locale = isLocale(alert.locale) ? alert.locale : "en";
    if (await mailer.sendEmail("back-in-stock", alert.email, backInStockEmail(name, `${clientUrl()}/products/${alert.productId}`, locale)))
      sent++;
  }
  return sent;
}

// After a stock change (product edit, import): fire and forget.
export function sendBackInStockAlertsInBackground(productIds: string[]) {
  void track(
    sendBackInStockAlerts(productIds).catch((err) => logger.error({ err }, "Back-in-stock alerts failed")),
  );
}

// Catches every other way stock comes back (cancelled or expired orders,
// returns…) on an interval. Returns a function that stops it.
export function startStockAlertJob(intervalMs = 5 * 60_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const count = await sendBackInStockAlerts();
      if (count > 0) logger.info({ count }, "Sent back-in-stock alerts");
    } catch (err) {
      logger.error({ err }, "Back-in-stock job failed");
      Sentry.captureException(err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
