import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { analyticsApi } from "../../api/analytics";
import { StatCard } from "../../components/StatCard";
import { useAuth } from "../../store/AuthContext";
import { formatPrice } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "@/lib/utils";

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
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description={`Revenue and order activity over the last ${days} days.`}
        actions={
          <div
            className="inline-flex gap-1 rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="Date range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                aria-pressed={days === opt.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  days === opt.value
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {!isSuperAdmin && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          These numbers reflect revenue and orders attributable to your shop
          only.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue"
          value={formatPrice(data?.totalRevenue ?? 0)}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          label="Paid orders"
          value={data?.totalOrders ?? 0}
          icon={ShoppingBag}
          accent="blue"
        />
        <StatCard
          label="Avg. order value"
          value={formatPrice(data?.averageOrderValue ?? 0)}
          icon={TrendingUp}
          accent="brand"
        />
      </div>

      {/* Revenue chart ------------------------------------------ */}
      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-serif text-lg font-bold text-foreground">
            Revenue over time
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Daily paid-order revenue for the selected range.
          </p>
        </div>

        <div className="p-6">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : data && data.revenueByDay.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.revenueByDay}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--accent)", strokeOpacity: 0.35 }}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--popover-foreground)",
                      fontSize: 13,
                      boxShadow: "var(--elevation-lg)",
                    }}
                    labelStyle={{
                      color: "var(--muted-foreground)",
                      marginBottom: 4,
                    }}
                    formatter={(value: number) => [
                      formatPrice(Number(value)),
                      "Revenue",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">
              No paid orders in this period yet.
            </p>
          )}
        </div>
      </section>

      {/* Top products ------------------------------------------- */}
      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
            <Package className="h-4 w-4 text-accent" />
            Top products
          </h2>
        </div>

        {data && data.topProducts.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Units sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={i}>
                    <td className="font-medium text-foreground">
                      <span className="mr-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-brand-700 dark:text-accent">
                        {i + 1}
                      </span>
                      {p.productName}
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {p.unitsSold}
                    </td>
                    <td className="text-right font-medium tabular-nums text-foreground">
                      {formatPrice(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No sales data yet.
          </p>
        )}
      </section>
    </div>
  );
}
