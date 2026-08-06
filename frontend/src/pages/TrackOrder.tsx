import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ordersApi } from "../api/orders";
import { Order } from "../api/types";
import toast from "react-hot-toast";

const statusColors: Record<string, string> = {
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
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-card to-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif font-bold text-4xl md:text-5xl mb-4 text-foreground">
            Track Your Order
          </h1>
          <p className="text-muted-foreground text-lg">
            Enter your tracking order ID and your email to monitor your order
            status
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <form onSubmit={handleSubmit} className="mb-12 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Order ID
            </label>
            <input
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
              placeholder="e.g. 3f2a9c1b-..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Looking up..." : "Find order"}
          </button>
        </form>

        {order && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-muted-foreground">
                #{order.id.slice(0, 8)}
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColors[order.status]}`}
              >
                {order.status}
              </span>
            </div>
            <div className="mt-4 divide-y divide-border border-t border-border">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between py-2 text-sm"
                >
                  <span className="text-foreground">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="font-medium text-foreground">
                    ${(Number(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold text-foreground">
              <span>Total</span>
              <span>${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>{" "}
          to see all your orders in one place.
        </p>
      </div>
    </div>
  );
}
