import { api } from "./client";

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface AnalyticsOverview {
  days: number;
  revenueByDay: RevenuePoint[];
  topProducts: TopProduct[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export const analyticsApi = {
  overview: (days: number) => api.get<AnalyticsOverview>("/analytics/overview", { params: { days } }).then((r) => r.data),
};
