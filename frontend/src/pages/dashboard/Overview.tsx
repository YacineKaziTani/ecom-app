import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Tags,
  ClipboardList,
  Banknote,
  Store,
  ArrowRight,
} from "lucide-react";
import { productsApi } from "../../api/products";
import { categoriesApi } from "../../api/categories";
import { ordersApi } from "../../api/orders";
import { shopsApi } from "../../api/shops";
import { useAuth } from "../../store/AuthContext";
import { orderStatusBadge, formatPrice, formatDate } from "../../lib/status";
import { StatCard } from "../../components/StatCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";

export default function Overview() {
  const { isSuperAdmin } = useAuth();

  const { data: myShop, isLoading: shopLoading } = useQuery({
    queryKey: ["myShop"],
    queryFn: shopsApi.mine,
    retry: false,
    enabled: !isSuperAdmin,
  });

  const { data: products } = useQuery({
    queryKey: ["products", { page: 1, limit: 1, shopId: myShop?.id }],
    queryFn: () =>
      productsApi.list({
        page: 1,
        limit: 1,
        shopId: isSuperAdmin ? undefined : myShop?.id,
      }),
    enabled: isSuperAdmin || !!myShop,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  // Totals are computed server-side (and scoped to "my shop's items" for a
  // shop admin), so the overview never downloads the full order history.
  const { data: summary } = useQuery({
    queryKey: ["orders", "summary"],
    queryFn: ordersApi.summary,
    enabled: isSuperAdmin || !!myShop,
  });
  const { data: recent } = useQuery({
    queryKey: ["orders", "recent"],
    queryFn: () => ordersApi.list({ page: 1, limit: 5 }),
    enabled: isSuperAdmin || !!myShop,
  });
  const orders = recent?.items;

  if (!isSuperAdmin && shopLoading) return null;

  if (!isSuperAdmin && !myShop) {
    return (
      <EmptyState
        icon={Store}
        title="Create your shop to get started"
        description="Your dashboard fills up with stats, orders and revenue once your shop exists."
        action={
          <Link to="/dashboard/my-shop" className="btn-primary">
            Create my shop
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={isSuperAdmin ? "Platform" : "Your shop"}
        title={isSuperAdmin ? "Overview" : `${myShop?.name}`}
        description="A snapshot of your catalogue, orders and revenue."
        actions={
          <Link to="/dashboard/analytics" className="btn-outline">
            View analytics
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isSuperAdmin ? "Total products" : "My products"}
          value={products?.total ?? 0}
          icon={Package}
          accent="brand"
        />
        <StatCard
          label="Categories"
          value={categories?.length ?? 0}
          icon={Tags}
          accent="blue"
        />
        <StatCard
          label={isSuperAdmin ? "Total orders" : "Orders with my items"}
          value={summary?.totalOrders ?? 0}
          icon={ClipboardList}
          accent="amber"
          hint={`${summary?.pendingOrders ?? 0} pending`}
        />
        <StatCard
          label="Revenue"
          value={formatPrice(summary?.revenue ?? 0)}
          icon={Banknote}
          accent="green"
          hint="Paid orders"
        />
      </div>

      {/* Recent orders ------------------------------------------ */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-foreground">
            Recent orders
          </h2>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {orders && orders.length > 0 ? (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs font-semibold text-accent">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="text-foreground">
                        {o.user
                          ? `${o.user.firstName} ${o.user.lastName}`
                          : o.guestEmail
                            ? `${o.guestEmail} (guest)`
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </td>
                      <td>
                        <span className={orderStatusBadge[o.status]}>
                          {o.status}
                        </span>
                      </td>
                      <td className="text-right font-medium tabular-nums text-foreground">
                        {formatPrice(
                          isSuperAdmin
                            ? Number(o.total)
                            : o.items.reduce(
                                (s, i) => s + Number(i.price) * i.quantity,
                                0,
                              ),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="Orders containing your products will show up here as soon as they come in."
          />
        )}
      </section>
    </div>
  );
}
