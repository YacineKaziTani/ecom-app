import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, MapPin } from "lucide-react";
import { ordersApi } from "../api/orders";
import { Order } from "../api/types";
import {
  orderStatusBadge,
  paymentStatusBadge,
  formatPrice,
  formatDate,
} from "../lib/status";
import { PageHeader } from "../components/ui/PageHeader";
import toast from "react-hot-toast";

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const mutation = useMutation({
    mutationFn: () => ordersApi.track(orderId.trim(), email.trim()),
    onSuccess: (data) => setOrder(data),
    onError: (err: any) => {
      setOrder(null);
      toast.error(String(err) || "Order not found");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader
        variant="hero"
        eyebrow="Guest checkout"
        title="Track your order"
        description="Enter the order ID from your confirmation email along with the email you used at checkout."
      />

      <div className="container-narrow max-w-xl py-10 sm:py-14">
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label htmlFor="orderId" className="label">
              Order ID
            </label>
            <input
              id="orderId"
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="input font-mono"
              placeholder="3f2a9c1b-…"
            />
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary btn-lg w-full"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {mutation.isPending ? "Looking up…" : "Find my order"}
          </button>
        </form>

        {order && (
          <article className="card mt-6 animate-fade-up overflow-hidden">
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

            <div className="flex items-baseline justify-between border-t border-border px-5 py-4">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-serif text-xl font-bold tabular-nums text-foreground">
                {formatPrice(order.total)}
              </span>
            </div>

            {order.shippingAddress && (
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
            )}
          </article>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link to="/login" className="link-accent">
            Sign in
          </Link>{" "}
          to see every order in one place.
        </p>
      </div>
    </div>
  );
}
