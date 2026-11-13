import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Home, MapPin, Truck } from "lucide-react";
import { shippingApi } from "../api/shipping";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { dayRange } from "../lib/days";
import { savedWilaya, saveWilaya } from "../lib/deliveryWilaya";
import { formatPrice } from "../lib/status";

// "Delivery to Oran: 600 DA, 2 to 7 days" on the product page, for the
// wilaya the customer picks (remembered, and used at checkout).
export function DeliveryEstimate() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 5 * 60 * 1000 });
  const { data: settings } = useStoreSettings();
  const [code, setCode] = useState<number | "">(() => savedWilaya() ?? user?.wilayaCode ?? "");
  useEffect(() => {
    if (code === "" && user?.wilayaCode) setCode(user.wilayaCode);
  }, [user?.wilayaCode, code]);

  const active = zones?.filter((z) => z.isActive) ?? [];
  const zone = active.find((z) => z.code === code);
  const fee = (price: number) => (Number(price) === 0 ? t("common.free") : formatPrice(price));

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Truck className="h-4 w-4 text-accent" />
          {t("product.delivery.title")}
        </p>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="sr-only">{t("product.delivery.wilaya")}</span>
          <select
            value={code}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : "";
              setCode(next);
              saveWilaya(next || null);
            }}
            aria-label={t("product.delivery.wilaya")}
            className="h-8 max-w-[11rem] cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="">{t("product.delivery.choose")}</option>
            {active.map((z) => (
              <option key={z.code} value={z.code}>
                {String(z.code).padStart(2, "0")} — {lang === "ar" && z.nameAr ? z.nameAr : z.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {zone ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <dt className="text-muted-foreground">{t("product.delivery.home")}</dt>
            <dd className="ms-auto font-semibold text-foreground sm:ms-0">{fee(zone.homePrice)}</dd>
          </div>
          {zone.deskPrice != null && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <dt className="text-muted-foreground">{t("product.delivery.desk")}</dt>
              <dd className="ms-auto font-semibold text-foreground sm:ms-0">{fee(zone.deskPrice)}</dd>
            </div>
          )}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <dt className="text-muted-foreground">{t("product.delivery.time")}</dt>
            <dd className="ms-auto font-semibold text-foreground sm:ms-0">
              {dayRange(lang, settings?.deliveryDaysMin ?? 2, settings?.deliveryDaysMax ?? 7)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("product.delivery.hint")}</p>
      )}
      {settings?.freeShippingThreshold != null && settings.freeShippingThreshold > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-sm font-medium text-success">
          {t("product.delivery.freeFrom", { amount: formatPrice(settings.freeShippingThreshold) })}
        </p>
      )}
    </div>
  );
}
