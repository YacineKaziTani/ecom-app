import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { CreditCard, PackageOpen, ChevronRight } from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import {
  orderStatusBadge,
  paymentStatusBadge,
  formatPrice,
  formatDate,
  formatTime,
} from "../lib/status";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { CardListSkeleton } from "../components/ui/Skeleton";
import { Pagination } from "../components/Pagination";
import toast from "react-hot-toast";

export default function MyOrders() {
  const [page, setPage] = useState(1);
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
        eyebrow="Your account"
        title="My orders"
        description="Every order you've placed, with its current status and payment state."
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
                      Placed {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={paymentStatusBadge[order.paymentStatus]}>
                      {order.paymentStatus}
                    </span>
                    <span className={orderStatusBadge[order.status]}>
                      {order.status}
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
                        {item.productName}
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

                <div className="space-y-1.5 border-t border-border px-5 py-4">
                  {order.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums">
                          {formatPrice(order.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-success">
                        <span>
                          Discount
                          {order.couponCode ? ` (${order.couponCode})` : ""}
                        </span>
                        <span className="tabular-nums">
                          −{formatPrice(order.discountAmount)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-serif text-xl font-bold tabular-nums text-foreground">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>

                {order.paymentStatus !== "paid" && order.status !== "cancelled" && (
                  <div className="border-t border-border bg-secondary/30 px-5 py-4">
                    <button
                      onClick={() => payMutation.mutate(order.id)}
                      disabled={payMutation.isPending}
                      className="btn-primary w-full"
                    >
                      <CreditCard className="h-4 w-4" />
                      {payMutation.isPending ? "Redirecting…" : "Pay now"}
                    </button>
                    {order.reservedUntil && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Items held until {formatTime(order.reservedUntil)} — unpaid
                        orders are cancelled after that.
                      </p>
                    )}
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
            title="No orders yet"
            description="When you place your first order it will appear here, along with its delivery status."
            action={
              <Link to="/" className="btn-primary">
                Start shopping
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
