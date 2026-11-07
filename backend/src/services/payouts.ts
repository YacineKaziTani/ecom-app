import { AppDataSource } from "../config/data-source";

// Platform commission on every sale, as a percentage of the item price.
// Snapshotted onto each order line at checkout.
export function commissionPercent(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.PLATFORM_COMMISSION_PERCENT ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0;
}

export interface ShopBalance {
  shopId: string;
  shopName: string;
  sales: number; // paid, non-cancelled item revenue
  commission: number; // platform's share of those sales
  discounts: number; // the shop's own coupons
  earned: number; // sales − commission − discounts
  paidOut: number;
  balance: number; // earned − paidOut (negative = paid too much, e.g. after a cancellation)
}

const round = (n: number) => Math.round(n * 100) / 100;

// Earnings only count once the money is in: card orders when paid, pay-on-
// delivery orders when delivered (that's when they're marked paid). A later
// cancellation removes them again.
export async function shopBalances(shopId?: string): Promise<ShopBalance[]> {
  const rows = await AppDataSource.query(
    `SELECT s.id AS "shopId", s.name AS "shopName",
            COALESCE(e.sales, 0) AS sales,
            COALESCE(e.commission, 0) AS commission,
            COALESCE(d.discounts, 0) AS discounts,
            COALESCE(p.paid, 0) AS "paidOut"
     FROM shops s
     LEFT JOIN (
       SELECT oi."shopId" AS shop_id,
              SUM(oi.price * oi.quantity) AS sales,
              SUM(oi.price * oi.quantity * oi."commissionRate" / 100) AS commission
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE o."paymentStatus" = 'paid' AND o.status <> 'cancelled'
       GROUP BY oi."shopId"
     ) e ON e.shop_id = s.id::text
     LEFT JOIN (
       SELECT o."couponShopId" AS shop_id, SUM(o."discountAmount") AS discounts
       FROM orders o
       WHERE o."paymentStatus" = 'paid' AND o.status <> 'cancelled' AND o."couponShopId" IS NOT NULL
       GROUP BY o."couponShopId"
     ) d ON d.shop_id = s.id
     LEFT JOIN (
       SELECT "shopId", SUM(amount) AS paid FROM payouts GROUP BY "shopId"
     ) p ON p."shopId" = s.id
     WHERE ($1::uuid IS NULL OR s.id = $1::uuid)
     ORDER BY s.name ASC`,
    [shopId ?? null],
  );

  return rows.map((r: any) => {
    const sales = round(Number(r.sales));
    const commission = round(Number(r.commission));
    const discounts = round(Number(r.discounts));
    const earned = round(sales - commission - discounts);
    const paidOut = round(Number(r.paidOut));
    return {
      shopId: r.shopId,
      shopName: r.shopName,
      sales,
      commission,
      discounts,
      earned,
      paidOut,
      balance: round(earned - paidOut),
    };
  });
}
