import { MapPin, Phone, Package } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { Order } from "../api/types";
import { deliveryLine, formatPrice, orderStatusBadge } from "../lib/status";

// Subtotal / discount / delivery / total rows shared by every order view.
export function OrderTotals({ order }: { order: Order }) {
  const { t } = useI18n();
  const discount = Number(order.discountAmount);
  const shipping = Number(order.shippingFee);
  const showBreakdown = discount > 0 || shipping > 0 || order.wilayaName;

  return (
    <div className="space-y-1.5 border-t border-border px-5 py-4">
      {showBreakdown && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("order.subtotal")}</span>
          <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-sm text-success">
          <span>{t("order.discount")}{order.couponCode ? ` (${order.couponCode})` : ""}</span>
          <span className="tabular-nums">−{formatPrice(discount)}</span>
        </div>
      )}
      {order.wilayaName && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("order.delivery")}</span>
          <span className="tabular-nums">{shipping > 0 ? formatPrice(shipping) : t("common.free")}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between pt-1">
        <span className="font-semibold text-foreground">{t("order.total")}</span>
        <span className="font-serif text-xl font-bold tabular-nums text-foreground">
          {formatPrice(order.total)}
        </span>
      </div>
    </div>
  );
}

// "Shipping to" block: address, wilaya/commune and the contact number.
export function DeliveryDetails({ order }: { order: Order }) {
  const { t } = useI18n();
  const location = deliveryLine(order);
  return (
    <div className="flex items-start gap-2.5 border-t border-border bg-secondary/30 px-5 py-4">
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("order.shippingTo")}
        </p>
        {location && (
          <p className="mt-1 text-sm font-medium text-foreground">{location}</p>
        )}
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">
          {order.shippingAddress}
        </p>
        {order.phone && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {order.phone}
          </p>
        )}
      </div>
    </div>
  );
}

// Each shop ships its own items: show per-shop progress when there's more
// than one shop, or as soon as a tracking number exists.
export function ShipmentList({ order }: { order: Order }) {
  const { t } = useI18n();
  const shipments = order.shipments ?? [];
  const worthShowing =
    shipments.length > 1 || shipments.some((s) => s.trackingNumber);
  if (!worthShowing) return null;

  return (
    <div className="space-y-2 border-t border-border px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("order.shipments")}
      </p>
      {shipments.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <Package className="h-4 w-4 text-muted-foreground" />
            {s.shop?.name ?? "Shop"}
            {s.trackingNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                {s.carrier ? `${s.carrier} · ` : ""}
                {s.trackingNumber}
              </span>
            )}
          </span>
          <span className={orderStatusBadge[s.status]}>{t(`status.${s.status}`)}</span>
        </div>
      ))}
    </div>
  );
}
