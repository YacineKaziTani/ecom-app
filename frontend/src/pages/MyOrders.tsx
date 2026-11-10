import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Link } from "react-router";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { CreditCard, PackageOpen, ChevronRight } from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import {
  orderStatusBadge,
  paymentBadge,
  paymentLabelKey,
  formatPrice,
  formatDate,
  formatTime,
} from "../lib/status";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { CardListSkeleton } from "../components/ui/Skeleton";
import { Pagination } from "../components/Pagination";
import { OrderTotals, ShipmentList } from "../components/OrderTotals";
import toast from "react-hot-toast";
import { itemLabel } from "../lib/cart";
import { CancelOrder } from "../components/CancelOrder";

export default function MyOrders() {
  const [page, setPage] = useState(1);
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["orders", "mine", page],
    queryFn: () => ordersApi.list({ page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const orders = data?.items;

  const payMutation = useMutation({
    mutationFn: (orderId: string) => paymentsApi.createCheckout(orderId),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (err: any) => toast.error(String(err) || "Could not start payment"),
  });

  return (
    <div>
      <PageHeader
        variant="hero"
        eyebrow={t("orders.eyebrow")}
        title={t("orders.title")}
        description={t("orders.subtitle")}
      />

      <div className="container-narrow py-10 sm:py-14">
        {isLoading ? (
          <CardListSkeleton count={3} />
        ) : orders && orders.length > 0 ? (
          <div className="space-y-5">
            {orders.map((order) => (
              <article key={order.id} className="card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-4">
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      #{order.id.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("order.placedOn", { date: formatDate(order.createdAt) })}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={paymentBadge(order)}>
                      {t(paymentLabelKey(order))}
                    </span>
                    <span className={orderStatusBadge[order.status]}>
                      {t(`status.${order.status}`)}
                    </span>
                  </div>
                </header>

                <div className="divide-y divide-border px-5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span className="min-w-0 flex-1 text-foreground">
                        {itemLabel(item.productName, item.variantName)}
                        <span className="text-muted-foreground">
                          {" "}
                          × {item.quantity}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatPrice(Number(item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <OrderTotals order={order} />
                <ShipmentList order={order} />

                {order.paymentMethod === "card" && order.paymentStatus !== "paid" && order.status !== "cancelled" && (
                  <div className="border-t border-border bg-secondary/30 px-5 py-4">
                    <button
                      onClick={() => payMutation.mutate(order.id)}
                      disabled={payMutation.isPending}
                      className="btn-primary w-full"
                    >
                      <CreditCard className="h-4 w-4" />
                      {payMutation.isPending ? t("order.redirecting") : t("order.payNow")}
                    </button>
                    {order.reservedUntil && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        {t("order.heldUntil", { time: formatTime(order.reservedUntil) })}
                      </p>
                    )}
                  </div>
                )}

                {order.cancelledBy === "customer" && order.status === "cancelled" ? (
                  <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                    {t("order.cancelledByYou")}
                  </p>
                ) : (
                  <div className="flex justify-end border-t border-border px-5 py-2 empty:hidden">
                    <CancelOrder order={order} />
                  </div>
                )}
              </article>
            ))}
            {data && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onPageChange={setPage}
              />
            )}
          </div>
        ) : (
          <EmptyState
            icon={PackageOpen}
            title={t("orders.emptyTitle")}
            description={t("orders.emptyBody")}
            action={
              <Link to="/" className="btn-primary">
                {t("orders.start")}
                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
