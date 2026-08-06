import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingBag, TrendingUp, Package } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { analyticsApi } from "../../api/analytics";
import { StatCard } from "../../components/StatCard";
import { useAuth } from "../../store/AuthContext";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function Analytics() {
  const { isSuperAdmin } = useAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "overview", days],
    queryFn: () => analyticsApi.overview(days),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Analytics
        </h1>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          These numbers reflect revenue and orders attributable to your shop
          only.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue"
          value={`$${(data?.totalRevenue ?? 0).toFixed(2)}`}
          icon={DollarSign}
          accent="brand"
        />
        <StatCard
          label="Paid Orders"
          value={data?.totalOrders ?? 0}
          icon={ShoppingBag}
          accent="blue"
        />
        <StatCard
          label="Avg. Order Value"
          value={`$${(data?.averageOrderValue ?? 0).toFixed(2)}`}
          icon={TrendingUp}
          accent="amber"
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-foreground">
          Revenue over time
        </h2>
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            Loading...
          </div>
        ) : data && data.revenueByDay.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--foreground)",
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [
                    `$${Number(value).toFixed(2)}`,
                    "Revenue",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            No paid orders in this period yet.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <Package className="h-4 w-4 text-muted-foreground" />
          Top products
        </h2>
        {data && data.topProducts.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Units sold</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 text-foreground">{p.productName}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {p.unitsSold}
                  </td>
                  <td className="py-2 text-right font-medium text-foreground">
                    ${p.revenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No sales data yet.
          </p>
        )}
      </div>
    </div>
  );
}
