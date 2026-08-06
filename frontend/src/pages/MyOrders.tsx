import { useQuery, useMutation } from "@tanstack/react-query";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { OrderStatus, PaymentStatus } from "../api/types";
import { CreditCard, PackageOpen } from "lucide-react";
import toast from "react-hot-toast";

const statusColors: Record<OrderStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  processing:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  shipped:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  delivered:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function MyOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const payMutation = useMutation({
    mutationFn: (orderId: string) => paymentsApi.createCheckout(orderId),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (err: any) =>
      toast.error(String(err) || "Could not start payment"),
  });

  if (isLoading)
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading orders...
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-card to-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif font-bold text-4xl md:text-5xl mb-4 text-foreground">
            My Orders
          </h1>
        </div>
      </div>

      {orders && orders.length > 0 ? (
        <div className="mx-auto max-w-3xl px-4 lg:px-0 m-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Order #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${paymentStatusColors[order.paymentStatus]}`}
                  >
                    {order.paymentStatus}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColors[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 divide-y divide-border border-t border-border">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between py-2 text-sm text-foreground"
                  >
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 border-t border-border pt-3">
                {order.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${Number(order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Discount
                        {order.couponCode ? ` (${order.couponCode})` : ""}
                      </span>
                      <span>-${Number(order.discountAmount).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Total</span>
                  <span>${Number(order.total).toFixed(2)}</span>
                </div>
              </div>

              {order.paymentStatus !== "paid" && (
                <button
                  onClick={() => payMutation.mutate(order.id)}
                  disabled={payMutation.isPending}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {payMutation.isPending ? "Redirecting..." : "Pay now"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            You haven't placed any orders yet.
          </p>
        </div>
      )}
    </div>
  );
}
