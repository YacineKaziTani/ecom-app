import { useState, FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { ordersApi } from "../api/orders";
import { Order } from "../api/types";
import {
  orderStatusBadge,
  paymentBadge,
  paymentLabelKey,
  formatPrice,
  formatDate,
} from "../lib/status";
import { PageHeader } from "../components/ui/PageHeader";
import { OrderTotals, DeliveryDetails, ShipmentList } from "../components/OrderTotals";
import toast from "react-hot-toast";

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const { t } = useI18n();
  useDocumentMeta(t("track.title"));

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
        eyebrow={t("track.eyebrow")}
        title={t("track.title")}
        description={t("track.subtitle")}
      />

      <div className="container-narrow max-w-xl py-10 sm:py-14">
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label htmlFor="orderId" className="label">
              {t("track.orderId")}
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
              {t("track.email")}
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
            {mutation.isPending ? t("track.lookingUp") : t("track.find")}
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

            <OrderTotals order={order} />
            <ShipmentList order={order} />

            <DeliveryDetails order={order} />
          </article>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("track.haveAccount")}{" "}
          <Link to="/login" className="link-accent">
            {t("nav.signIn")}
          </Link>{" "}
          {t("track.signInHint")}
        </p>
      </div>
    </div>
  );
}
