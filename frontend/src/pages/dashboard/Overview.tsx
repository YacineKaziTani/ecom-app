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
import { useI18n } from "../../i18n/I18nProvider";

export default function Overview() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();

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
        title={t("dash.overview.noShopTitle")}
        description={t("dash.overview.noShopBody")}
        action={
          <Link to="/dashboard/my-shop" className="btn-primary">
            {t("dash.products.createShop")}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={isSuperAdmin ? t("dash.overview.platform") : t("dash.overview.yourShop")}
        title={isSuperAdmin ? t("dash.nav.overview") : `${myShop?.name}`}
        description={t("dash.overview.description")}
        actions={
          <Link to="/dashboard/analytics" className="btn-outline">
            {t("dash.overview.viewAnalytics")}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isSuperAdmin ? t("dash.overview.totalProducts") : t("dash.overview.myProducts")}
          value={products?.total ?? 0}
          icon={Package}
          accent="brand"
        />
        <StatCard
          label={t("dash.overview.categories")}
          value={categories?.length ?? 0}
          icon={Tags}
          accent="blue"
        />
        <StatCard
          label={isSuperAdmin ? t("dash.overview.totalOrders") : t("dash.overview.myOrders")}
          value={summary?.totalOrders ?? 0}
          icon={ClipboardList}
          accent="amber"
          hint={t("dash.overview.pending", { count: summary?.pendingOrders ?? 0 })}
        />
        <StatCard
          label={t("dash.overview.revenue")}
          value={formatPrice(summary?.revenue ?? 0)}
          icon={Banknote}
          accent="green"
          hint={t("dash.overview.paidOrders")}
        />
      </div>

      {/* Recent orders ------------------------------------------ */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-foreground">
            {t("dash.overview.recent")}
          </h2>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
          >
            {t("dash.overview.viewAll")}
            <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </Link>
        </div>

        {orders && orders.length > 0 ? (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("dash.col.order")}</th>
                    <th>{t("dash.col.customer")}</th>
                    <th>{t("dash.col.date")}</th>
                    <th>{t("dash.col.status")}</th>
                    <th className="text-end">{t("dash.col.total")}</th>
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
                            ? `${o.guestEmail} ${t("dash.orders.guest")}`
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </td>
                      <td>
                        <span className={orderStatusBadge[o.status]}>
                          {t(`status.${o.status}`)}
                        </span>
                      </td>
                      <td className="text-end font-medium tabular-nums text-foreground">
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
            title={t("dash.overview.emptyTitle")}
            description={t("dash.overview.emptyBody")}
          />
        )}
      </section>
    </div>
  );
}
