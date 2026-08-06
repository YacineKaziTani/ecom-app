import { useState } from "react";
import { useLocation, useParams, useSearchParams, Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Copy, Check, CreditCard, AlertCircle } from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { useAuth } from "../store/AuthContext";
import { Order } from "../api/types";
import toast from "react-hot-toast";

const paymentStatusLabel: Record<string, { label: string; className: string }> = {
  unpaid: { label: "Payment pending", className: "bg-amber-100 text-amber-700" },
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
    queryFn: () => (user ? ordersApi.get(id!) : ordersApi.track(id!, emailFromUrl!)),
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

  if (!order && isLoading) return <div className="py-20 text-center text-gray-400">Loading order...</div>;
  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400">We couldn't find that order.</p>
        {!user && (
          <p className="mt-2 text-sm text-gray-400">
            If you checked out as a guest, try the{" "}
            <Link to="/track-order" className="font-medium text-brand-600 hover:underline">
              order tracker
            </Link>{" "}
            with your order ID and email instead.
          </p>
        )}
        <Link to="/" className="btn-primary mt-4 inline-flex">Back to shop</Link>
      </div>
    );
  }

  const paymentInfo = paymentStatusLabel[order.paymentStatus];

  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Order placed!</h1>
      <p className="mt-1 text-gray-500">Your order has been recorded.</p>

      <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${paymentInfo.className}`}>
        {paymentInfo.label}
      </span>

      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
        <span className="font-mono text-sm text-gray-700">{order.id}</span>
        <button
          onClick={handleCopy}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          title="Copy order ID"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {order.paymentStatus !== "paid" && (
        <div className="mt-4 card border-amber-200 bg-amber-50/60 p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertCircle className="h-4 w-4" />
            {order.paymentStatus === "failed" ? "Your last payment attempt failed." : "Payment hasn't been completed yet."}
          </p>
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="btn-primary mt-3 w-full gap-2"
          >
            <CreditCard className="h-4 w-4" />
            {payMutation.isPending ? "Redirecting..." : "Pay now"}
          </button>
        </div>
      )}

      <div className="card mt-6 p-6 text-left">
        <h2 className="mb-3 font-semibold text-gray-900">Summary</h2>
        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-2 text-sm">
              <span className="text-gray-700">{item.productName} × {item.quantity}</span>
              <span className="font-medium text-gray-900">${(Number(item.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
          {order.discountAmount > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>${Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span>-${Number(order.discountAmount).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">Shipping to: {order.shippingAddress}</p>
      </div>

      {user ? (
        <Link to="/orders" className="btn-primary mt-6 inline-flex">View all my orders</Link>
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-gray-500">
            {guestEmail ? (
              <>We sent a confirmation to <span className="font-medium">{guestEmail}</span>. </>
            ) : null}
            Save the order ID above (copy button included) — you'll need it along with your email to check status later.
          </p>
          <Link to="/track-order" className="btn-secondary inline-flex">Track this order later</Link>
        </div>
      )}
    </div>
  );
}
