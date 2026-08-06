import { AppDataSource } from "../config/data-source";

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface SummaryStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  pendingOrders: number;
}

export async function getRevenueTimeSeries(
  days: number,
  shopId?: string,
): Promise<RevenuePoint[]> {
  const params: any[] = [days];
  let shopFilter = "";
  if (shopId) {
    params.push(shopId);
    shopFilter = `AND oi."shopId" = $2`;
  }

  const rows = await AppDataSource.query(
    `
    SELECT
      to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS date,
      COALESCE(SUM(oi.price * oi.quantity), 0)::float AS revenue,
      COUNT(DISTINCT o.id)::int AS orders
    FROM orders o
    JOIN order_items oi ON oi."orderId" = o.id
    WHERE o."paymentStatus" = 'paid'
      AND o."createdAt" >= NOW() - ($1 || ' days')::interval
      ${shopFilter}
    GROUP BY date_trunc('day', o."createdAt")
    ORDER BY date_trunc('day', o."createdAt") ASC
    `,
    params,
  );

  return rows.map((r: any) => ({
    date: r.date,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }));
}

export async function getTopProducts(
  limit: number,
  shopId?: string,
): Promise<TopProduct[]> {
  const params: any[] = [limit];
  let shopFilter = "";
  if (shopId) {
    params.push(shopId);
    shopFilter = `AND oi."shopId" = $2`;
  }

  const rows = await AppDataSource.query(
    `
    SELECT
      oi."productId" AS "productId",
      oi."productName" AS "productName",
      SUM(oi.quantity)::int AS "quantitySold",
      SUM(oi.price * oi.quantity)::float AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    WHERE o."paymentStatus" = 'paid'
      ${shopFilter}
    GROUP BY oi."productId", oi."productName"
    ORDER BY revenue DESC
    LIMIT $1
    `,
    params,
  );

  return rows.map((r: any) => ({
    productId: r.productId,
    productName: r.productName,
    quantitySold: Number(r.quantitySold),
    revenue: Number(r.revenue),
  }));
}

export async function getSummaryStats(shopId?: string): Promise<SummaryStats> {
  const params: any[] = [];
  let shopFilter = "";
  if (shopId) {
    params.push(shopId);
    shopFilter = `AND oi."shopId" = $1`;
  }

  const [paidRow] = await AppDataSource.query(
    `
    SELECT
      COALESCE(SUM(oi.price * oi.quantity), 0)::float AS "totalRevenue",
      COUNT(DISTINCT o.id)::int AS "totalOrders"
    FROM orders o
    JOIN order_items oi ON oi."orderId" = o.id
    WHERE o."paymentStatus" = 'paid'
      ${shopFilter}
    `,
    params,
  );

  const pendingParams: any[] = [];
  let pendingShopFilter = "";
  if (shopId) {
    pendingParams.push(shopId);
    pendingShopFilter = `AND oi."shopId" = $1`;
  }
  const [pendingRow] = await AppDataSource.query(
    `
    SELECT COUNT(DISTINCT o.id)::int AS "pendingOrders"
    FROM orders o
    JOIN order_items oi ON oi."orderId" = o.id
    WHERE o.status = 'pending'
      ${pendingShopFilter}
    `,
    pendingParams,
  );

  const totalRevenue = Number(paidRow.totalRevenue);
  const totalOrders = Number(paidRow.totalOrders);

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    pendingOrders: Number(pendingRow.pendingOrders),
  };
}

export interface ShopRevenue {
  shopId: string;
  shopName: string;
  revenue: number;
  orders: number;
}

// Super_admin only — platform-wide breakdown by shop, for comparing shops
// against each other rather than looking at one shop's numbers in isolation.
export async function getRevenueByShop(days: number): Promise<ShopRevenue[]> {
  const rows = await AppDataSource.query(
    `
    SELECT
      s.id AS "shopId",
      s.name AS "shopName",
      COALESCE(SUM(oi.price * oi.quantity), 0)::float AS revenue,
      COUNT(DISTINCT o.id)::int AS orders
    FROM shops s
    LEFT JOIN order_items oi ON oi."shopId" = s.id
    LEFT JOIN orders o ON o.id = oi."orderId" AND o."paymentStatus" = 'paid' AND o."createdAt" >= NOW() - ($1 || ' days')::interval
    GROUP BY s.id, s.name
    ORDER BY revenue DESC
    `,
    [days],
  );

  return rows.map((r: any) => ({
    shopId: r.shopId,
    shopName: r.shopName,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }));
}
