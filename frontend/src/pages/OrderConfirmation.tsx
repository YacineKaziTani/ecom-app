import { useState } from "react";
import { useLocation, useParams, useSearchParams, Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  AlertCircle,
  PackageSearch,
  MapPin,
} from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { useAuth } from "../store/AuthContext";
import { Order } from "../api/types";
import {
  paymentStatusBadge,
  paymentStatusLabel,
  formatPrice,
} from "../lib/status";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import toast from "react-hot-toast";

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  // Prefer the order handed off via navigation state (right after checkout) so we
  // don't need an extra request. On a page reload, `state` is gone — fall back to
  // an actual fetch. Registered users re-fetch via their authenticated /orders/:id;
  // guests re-fetch via the public /orders/track lookup, using the email that was
  // put in the URL query string precisely so it survives a refresh.
  const stateOrder = (location.state as { order?: Order } | null)?.order;
  const emailFromUrl = searchParams.get("email");

  const { data: fetchedOrder, isLoading } = useQuery({
    queryKey: ["order", id, user ? "auth" : emailFromUrl],
    queryFn: () =>
      user ? ordersApi.get(id!) : ordersApi.track(id!, emailFromUrl!),
    enabled: !stateOrder && !!id && (!!user || !!emailFromUrl),
  });

  const order = stateOrder || fetchedOrder;
  const guestEmail = order?.guestEmail || emailFromUrl || undefined;

  const payMutation = useMutation({
    mutationFn: () => paymentsApi.createCheckout(order!.id),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (err: any) => toast.error(String(err) || "Could not start payment"),
  });

  function handleCopy() {
    if (!order) return;
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!order && isLoading) {
    return (
      <div className="container-narrow py-16">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="mt-6 h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-narrow py-16">
        <EmptyState
          icon={PackageSearch}
          title="We couldn't find that order"
          description={
            user
              ? "The order may have been removed, or the link is out of date."
              : "If you checked out as a guest, look it up with your order ID and email instead."
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {!user && (
                <Link to="/track-order" className="btn-primary">
                  Open order tracker
                </Link>
              )}
              <Link to="/" className="btn-outline">
                Back to shop
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const isPaid = order.paymentStatus === "paid";

  return (
    <div className="container-narrow py-12 sm:py-16">
      <div className="animate-fade-up text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </span>

        <h1 className="mt-6 text-3xl font-bold text-foreground sm:text-4xl">
          Order placed
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thanks — we've recorded your order and the makers have been notified.
        </p>

        <span className={`${paymentStatusBadge[order.paymentStatus]} mt-5`}>
          {paymentStatusLabel[order.paymentStatus]}
        </span>

        <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-xs">
          <span className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
            {order.id}
          </span>
          <button
            onClick={handleCopy}
            className="icon-btn flex-shrink-0 p-1.5"
            title="Copy order ID"
            aria-label="Copy order ID"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!isPaid && (
        <div className="mt-8 rounded-xl border border-warning/40 bg-warning-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {order.paymentStatus === "failed"
              ? "Your last payment attempt failed."
              : "Payment hasn't been completed yet."}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your items are reserved, but the order won't ship until payment
            clears.
          </p>
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="btn-primary mt-4 w-full"
          >
            <CreditCard className="h-4 w-4" />
            {payMutation.isPending ? "Redirecting…" : "Pay now"}
          </button>
        </div>
      )}

      <div className="card mt-8 overflow-hidden text-left">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <h2 className="font-serif text-lg font-bold text-foreground">
            Order summary
          </h2>
        </div>

        <div className="divide-y divide-border px-5">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 text-foreground">
                {item.productName}
                <span className="text-muted-foreground"> × {item.quantity}</span>
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
                  Discount{order.couponCode ? ` (${order.couponCode})` : ""}
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

        <div className="flex items-start gap-2.5 border-t border-border bg-secondary/30 px-5 py-4">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shipping to
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {order.shippingAddress}
            </p>
          </div>
        </div>
      </div>

      {user ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/orders" className="btn-primary">
            View all my orders
          </Link>
          <Link to="/" className="btn-outline">
            Keep shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {guestEmail && (
              <>
                We sent a confirmation to{" "}
                <span className="font-semibold text-foreground">
                  {guestEmail}
                </span>
                .{" "}
              </>
            )}
            Save the order ID above — you'll need it, along with your email, to
            check the status later.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/track-order" className="btn-outline">
              Track this order
            </Link>
            <Link to="/register" className="btn-ghost">
              Create an account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
