import { useState } from "react";
import { useLocation, useParams, useSearchParams, Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { useAuth } from "../store/AuthContext";
import { Order } from "../api/types";
import toast from "react-hot-toast";

const paymentStatusLabel: Record<string, { label: string; className: string }> =
  {
    unpaid: {
      label: "Payment pending",
      className: "bg-amber-100 text-amber-700",
    },
    paid: { label: "Paid", className: "bg-green-100 text-green-700" },
    failed: { label: "Payment failed", className: "bg-red-100 text-red-700" },
  };

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
    onError: (err: any) =>
      toast.error(String(err) || "Could not start payment"),
  });

  function handleCopy() {
    if (!order) return;
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!order && isLoading)
    return (
      <div className="py-20 text-center text-gray-400">Loading order...</div>
    );
  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400">We couldn't find that order.</p>
        {!user && (
          <p className="mt-2 text-sm text-gray-400">
            If you checked out as a guest, try the{" "}
            <Link
              to="/track-order"
              className="font-medium text-brand-600 hover:underline"
            >
              order tracker
            </Link>{" "}
            with your order ID and email instead.
          </p>
        )}
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Back to shop
        </Link>
      </div>
    );
  }

  const paymentInfo = paymentStatusLabel[order.paymentStatus];

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
        <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="mt-5 font-serif text-3xl font-bold text-foreground">
        Order placed!
      </h1>
      <p className="mt-1.5 text-muted-foreground">
        Your order has been recorded.
      </p>

      <span
        className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold ${paymentInfo.className}`}
      >
        {paymentInfo.label}
      </span>

      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2">
        <span className="font-mono text-sm text-foreground">{order.id}</span>
        <button
          onClick={handleCopy}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Copy order ID"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {order.paymentStatus !== "paid" && (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50/60 p-4 text-left shadow-sm dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {order.paymentStatus === "failed"
              ? "Your last payment attempt failed."
              : "Payment hasn't been completed yet."}
          </p>
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            {payMutation.isPending ? "Redirecting..." : "Pay now"}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-card p-6 text-left shadow-sm">
        <h2 className="mb-3 font-semibold text-foreground">Summary</h2>
        <div className="divide-y divide-border">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-2 text-sm">
              <span className="text-foreground">
                {item.productName} × {item.quantity}
              </span>
              <span className="font-medium text-foreground">
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
              <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-400">
                <span>
                  Discount{order.couponCode ? ` (${order.couponCode})` : ""}
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
        <p className="mt-4 text-sm text-muted-foreground">
          Shipping to: {order.shippingAddress}
        </p>
      </div>

      {user ? (
        <Link
          to="/orders"
          className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          View all my orders
        </Link>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {guestEmail ? (
              <>
                We sent a confirmation to{" "}
                <span className="font-medium text-foreground">
                  {guestEmail}
                </span>
                .{" "}
              </>
            ) : null}
            Save the order ID above (copy button included) — you'll need it
            along with your email to check status later.
          </p>
          <Link
            to="/track-order"
            className="inline-flex rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Track this order later
          </Link>
        </div>
      )}
    </div>
  );
}
