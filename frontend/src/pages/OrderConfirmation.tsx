import { useEffect, useState } from "react";
import { pixels } from "../lib/pixels";
import { useI18n } from "../i18n/I18nProvider";
import { useLocation, useParams, useSearchParams, Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  AlertCircle,
  PackageSearch,
  Banknote,
} from "lucide-react";
import { ordersApi } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { useAuth } from "../store/AuthContext";
import { Order } from "../api/types";
import {
  paymentBadge,
  paymentLabelKey,
  formatPrice,
  formatTime,
} from "../lib/status";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { OrderTotals, DeliveryDetails, ShipmentList } from "../components/OrderTotals";
import toast from "react-hot-toast";
import { itemLabel } from "../lib/cart";
import { CancelOrder } from "../components/CancelOrder";

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  // Set once the customer cancels here, so the page reflects it right away.
  const [updated, setUpdated] = useState<Order | null>(null);
  const { t } = useI18n();

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

  const order = updated || stateOrder || fetchedOrder;
  // Pay on delivery: the order is the sale. (Card orders count once paid,
  // on the payment success page.)
  useEffect(() => {
    if (order && order.paymentMethod === "cod" && order.status !== "cancelled") pixels.purchase(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);
  const guestEmail = order?.guestEmail || emailFromUrl || undefined;

  const payMutation = useMutation({
    mutationFn: () => paymentsApi.createCheckout(order!.id, guestEmail),
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
          title={t("order.notFoundTitle")}
          description={
            user
              ? t("order.notFoundUser")
              : t("order.notFoundGuest")
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {!user && (
                <Link to="/track-order" className="btn-primary">
                  {t("order.openTracker")}
                </Link>
              )}
              <Link to="/" className="btn-outline">
                {t("common.backToShop")}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const isPaid = order.paymentStatus === "paid";
  const isCod = order.paymentMethod === "cod";
  const canPay = !isPaid && !isCod && order.status !== "cancelled";

  return (
    <div className="container-narrow py-12 sm:py-16">
      <div className="animate-fade-up text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </span>

        <h1 className="mt-6 text-3xl font-bold text-foreground sm:text-4xl">
          {t("order.placedTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("order.placedBody")}
        </p>

        <span className={`${paymentBadge(order)} mt-5`}>
          {t(paymentLabelKey(order))}
        </span>

        <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-xs">
          <span className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
            {order.id}
          </span>
          <button
            onClick={handleCopy}
            className="icon-btn flex-shrink-0 p-1.5"
            title={t("order.copyId")}
            aria-label={t("order.copyId")}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {isCod && !isPaid && order.status !== "cancelled" && (
        <div className="mt-8 rounded-xl border border-info/30 bg-info-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-info">
            <Banknote className="h-4 w-4 flex-shrink-0" />
            {t("order.codTitle", { amount: formatPrice(order.total) })}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {order.phone
              ? t("order.codCall", { phone: order.phone })
              : t("order.codCallNoPhone")}
          </p>
        </div>
      )}

      {canPay && (
        <div className="mt-8 rounded-xl border border-warning/40 bg-warning-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {order.paymentStatus === "failed"
              ? t("order.lastPaymentFailed")
              : t("order.paymentNotDone")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {order.reservedUntil
              ? t("order.holdingUntil", { time: formatTime(order.reservedUntil) })
              : t("order.reserved")}
          </p>
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="btn-primary mt-4 w-full"
          >
            <CreditCard className="h-4 w-4" />
            {payMutation.isPending ? t("order.redirecting") : t("order.payNow")}
          </button>
        </div>
      )}

      <div className="card mt-8 overflow-hidden text-start">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <h2 className="font-serif text-lg font-bold text-foreground">
            {t("cart.summary")}
          </h2>
        </div>

        <div className="divide-y divide-border px-5">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 text-foreground">
                {itemLabel(item.productName, item.variantName)}
                <span className="text-muted-foreground"> × {item.quantity}</span>
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

        {order.status === "cancelled" && order.cancelledBy === "customer" ? (
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{t("order.cancelledByYou")}</p>
        ) : (
          <div className="flex justify-end border-t border-border px-5 py-2 empty:hidden">
            <CancelOrder order={order} email={user ? undefined : guestEmail} onCancelled={setUpdated} />
          </div>
        )}
      </div>

      {user ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/orders" className="btn-primary">
            {t("order.viewAll")}
          </Link>
          <Link to="/" className="btn-outline">
            {t("common.keepShopping")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {guestEmail && <>{t("order.guestSent", { email: guestEmail })} </>}
            {t("order.saveId")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link to="/track-order" className="btn-outline">
              {t("order.trackThis")}
            </Link>
            <Link to="/register" className="btn-ghost">
              {t("order.createAccount")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
