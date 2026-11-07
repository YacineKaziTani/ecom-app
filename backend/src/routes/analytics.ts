import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { requireAuth, requireAnyAdmin, attachShop } from "../middleware/auth";
import { clampInt } from "../utils/validators";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requireAnyAdmin,
  attachShop,
  async (req, res) => {
    const days = clampInt(req.query.days, 30, 1, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const isSuperAdmin = req.user!.role === "super_admin";

    let revenueByDay: { date: string; revenue: string; orders: string }[];
    let topProducts: {
      productName: string;
      unitsSold: string;
      revenue: string;
    }[];
    let totals: { totalRevenue: string | null; totalOrders: string };

    if (isSuperAdmin) {
      revenueByDay = await AppDataSource.query(
        `SELECT to_char(o."createdAt", 'YYYY-MM-DD') as date,
              SUM(o.total) as revenue,
              COUNT(*) as orders
       FROM orders o
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1
       GROUP BY date
       ORDER BY date ASC`,
        [since],
      );

      topProducts = await AppDataSource.query(
        `SELECT oi."productName" as "productName",
              SUM(oi.quantity) as "unitsSold",
              SUM(oi.price * oi.quantity) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1
       GROUP BY oi."productName"
       ORDER BY revenue DESC
       LIMIT 5`,
        [since],
      );

      const totalsRows = await AppDataSource.query(
        `SELECT SUM(o.total) as "totalRevenue", COUNT(*) as "totalOrders"
       FROM orders o
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1`,
        [since],
      );
      totals = totalsRows[0];
    } else {
      const shopId = req.shopId!;

      revenueByDay = await AppDataSource.query(
        `SELECT to_char(o."createdAt", 'YYYY-MM-DD') as date,
              SUM(oi.price * oi.quantity) as revenue,
              COUNT(DISTINCT o.id) as orders
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1 AND oi."shopId" = $2
       GROUP BY date
       ORDER BY date ASC`,
        [since, shopId],
      );

      topProducts = await AppDataSource.query(
        `SELECT oi."productName" as "productName",
              SUM(oi.quantity) as "unitsSold",
              SUM(oi.price * oi.quantity) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1 AND oi."shopId" = $2
       GROUP BY oi."productName"
       ORDER BY revenue DESC
       LIMIT 5`,
        [since, shopId],
      );

      const totalsRows = await AppDataSource.query(
        `SELECT SUM(oi.price * oi.quantity) as "totalRevenue", COUNT(DISTINCT o.id) as "totalOrders"
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE o."paymentStatus" = 'paid' AND o."createdAt" >= $1 AND oi."shopId" = $2`,
        [since, shopId],
      );
      totals = totalsRows[0];
    }

    const totalRevenue = Number(totals.totalRevenue) || 0;
    const totalOrders = Number(totals.totalOrders) || 0;

    res.json({
      days,
      revenueByDay: revenueByDay.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      })),
      topProducts: topProducts.map((p) => ({
        productName: p.productName,
        unitsSold: Number(p.unitsSold),
        revenue: Number(p.revenue),
      })),
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    });
  },
);

export default router;
