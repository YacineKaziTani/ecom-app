import { useEffect, useState, FormEvent, ReactNode } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, ShieldAlert, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { settingsApi } from "../../api/settings";
import type { StoreSettings } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageLoader } from "../../components/ui/PageLoader";
import { ImageUpload } from "../../components/ImageUpload";
import { STORE_SETTINGS_KEY, useStoreSettings } from "../../hooks/useStoreSettings";
import { formatPhone, formatWhatsapp, missingDetails, RequiredDetail } from "../../lib/contact";
import { cn } from "@/lib/utils";

const TEXT_FIELDS = [
  "brandName",
  "logoUrl",
  "legalName",
  "registerNumber",
  "taxId",
  "address",
  "phone",
  "whatsapp",
  "email",
  "openingHours",
  "facebookUrl",
  "instagramUrl",
  "tiktokUrl",
  "facebookPixelId",
  "tiktokPixelId",
] as const;
const NUMBER_FIELDS = ["deliveryDaysMin", "deliveryDaysMax", "exchangeDays"] as const;
type Field = (typeof TEXT_FIELDS)[number] | (typeof NUMBER_FIELDS)[number];
type Form = Record<Field, string>;

const DETAIL_LABEL: Record<RequiredDetail, MessageKey> = {
  legalName: "dash.store.legalName",
  registerNumber: "dash.store.registerNumber",
  taxId: "dash.store.taxId",
  address: "dash.store.address",
  email: "dash.store.email",
  phone: "dash.store.phone",
};

// What to say under a field the server rejected.
const ERROR_MESSAGE: Partial<Record<Field, MessageKey>> = {
  phone: "dash.store.err.phone",
  whatsapp: "dash.store.err.whatsapp",
  email: "dash.store.err.email",
  facebookUrl: "dash.store.err.url",
  instagramUrl: "dash.store.err.url",
  tiktokUrl: "dash.store.err.url",
  facebookPixelId: "dash.store.err.facebookPixel",
  tiktokPixelId: "dash.store.err.tiktokPixel",
};

function toForm(s: StoreSettings): Form {
  return {
    brandName: s.brandName,
    logoUrl: s.logoUrl ?? "",
    legalName: s.legalName ?? "",
    registerNumber: s.registerNumber ?? "",
    taxId: s.taxId ?? "",
    address: s.address ?? "",
    phone: s.phone ? formatPhone(s.phone) : "",
    whatsapp: s.whatsapp ? formatWhatsapp(s.whatsapp) : "",
    email: s.email ?? "",
    openingHours: s.openingHours ?? "",
    facebookUrl: s.facebookUrl ?? "",
    instagramUrl: s.instagramUrl ?? "",
    tiktokUrl: s.tiktokUrl ?? "",
    facebookPixelId: s.facebookPixelId ?? "",
    tiktokPixelId: s.tiktokPixelId ?? "",
    deliveryDaysMin: String(s.deliveryDaysMin),
    deliveryDaysMax: String(s.deliveryDaysMax),
    exchangeDays: String(s.exchangeDays),
  };
}

// Super admin: the business details behind the Contact page, the WhatsApp
// button and the legal pages.
export default function StoreInfo() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useStoreSettings();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, MessageKey>>>({});

  useEffect(() => {
    if (data && !form) setForm(toForm(data));
  }, [data, form]);

  const save = useMutation({
    mutationFn: (body: Record<string, string | number>) => settingsApi.update(body),
    onSuccess: (saved) => {
      qc.setQueryData(STORE_SETTINGS_KEY, saved);
      setForm(toForm(saved));
      setErrors({});
      toast.success(t("dash.store.saved"));
    },
    onError: (err: any) => {
      const fieldErrors: Record<string, string[]> | undefined = err?.data?.errors?.fieldErrors;
      if (fieldErrors) {
        const next: Partial<Record<Field, MessageKey>> = {};
        for (const key of Object.keys(fieldErrors) as Field[]) next[key] = ERROR_MESSAGE[key] ?? "dash.store.err.field";
        setErrors(next);
        toast.error(t("dash.store.invalid"));
      } else {
        toast.error(String(err));
      }
    },
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title={t("dash.restricted")} description={t("dash.superAdminOnly")} />;
  }
  if (isLoading || !form) return <PageLoader />;

  const missing = missingDetails(data);
  const set = (field: Field) => (e: { target: { value: string } }) => {
    setForm((f) => (f ? { ...f, [field]: e.target.value } : f));
    if (errors[field]) setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const numbers = Object.fromEntries(NUMBER_FIELDS.map((key) => [key, Number(form[key])]));
    if (numbers.deliveryDaysMin > numbers.deliveryDaysMax) {
      setErrors({ deliveryDaysMax: "dash.store.daysOrder" });
      toast.error(t("dash.store.invalid"));
      return;
    }
    const texts = Object.fromEntries(TEXT_FIELDS.map((key) => [key, form[key].trim()]));
    save.mutate({ ...texts, ...numbers });
  }

  const input = (field: (typeof TEXT_FIELDS)[number], props: { type?: string; maxLength?: number; placeholder?: string; dir?: string } = {}) => (
    <input
      id={`store-${field}`}
      value={form[field]}
      onChange={set(field)}
      aria-invalid={errors[field] ? true : undefined}
      aria-describedby={errors[field] ? `store-${field}-error` : undefined}
      className={cn("input", errors[field] && "border-destructive focus:ring-destructive/30")}
      {...props}
    />
  );
  const number = (field: (typeof NUMBER_FIELDS)[number], min: number) => (
    <input
      id={`store-${field}`}
      type="number"
      required
      min={min}
      max={60}
      step={1}
      value={form[field]}
      onChange={set(field)}
      aria-invalid={errors[field] ? true : undefined}
      aria-describedby={errors[field] ? `store-${field}-error` : undefined}
      className={cn("input", errors[field] && "border-destructive")}
    />
  );
  const field = (name: Field, label: MessageKey, control: ReactNode, hint?: MessageKey, className?: string) => (
    <div className={className}>
      <label htmlFor={`store-${name}`} className="label">{t(label)}</label>
      {control}
      {errors[name] ? (
        <p id={`store-${name}-error`} className="mt-1 text-xs text-destructive">{t(errors[name]!)}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{t(hint)}</p>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow={t("dash.store.eyebrow")} title={t("dash.store.title")} description={t("dash.store.description")} />

      <div
        className={cn(
          "mb-6 flex gap-3 rounded-lg border p-4 text-sm",
          missing.length ? "border-warning/30 bg-warning-soft" : "border-success/30 bg-success-soft",
        )}
      >
        {missing.length ? (
          <>
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div>
              <p className="font-medium text-foreground">{t("dash.store.missing")}</p>
              <p className="mt-1 text-muted-foreground">{missing.map((key) => t(DETAIL_LABEL[key])).join(" · ")}</p>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
            <p className="font-medium text-foreground">{t("dash.store.complete")}</p>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title={t("dash.store.brand")} hint={t("dash.store.brandHint")}>
          {field("brandName", "dash.store.brandName", input("brandName", { maxLength: 60, placeholder: "ArtisanShop" }), "dash.store.brandNameHint", "sm:col-span-2")}
          <div className="sm:col-span-2">
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => setForm((f) => (f ? { ...f, logoUrl: url } : f))}
              folder="brand"
              label={t("dash.store.logo")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("dash.store.logoHint")}</p>
          </div>
        </Section>

        <Section title={t("dash.store.identity")} hint={t("dash.store.identityHint")}>
          {field("legalName", "dash.store.legalName", input("legalName", { maxLength: 120 }), undefined, "sm:col-span-2")}
          {field("registerNumber", "dash.store.registerNumber", input("registerNumber", { maxLength: 60 }))}
          {field("taxId", "dash.store.taxId", input("taxId", { maxLength: 40 }))}
          {field("address", "dash.store.address", input("address", { maxLength: 300 }), undefined, "sm:col-span-2")}
        </Section>

        <Section title={t("dash.store.contact")} hint={t("dash.store.contactHint")}>
          {field("whatsapp", "dash.store.whatsapp", input("whatsapp", { type: "tel", placeholder: "0550 12 34 56", dir: "ltr" }))}
          {field("phone", "dash.store.phone", input("phone", { type: "tel", placeholder: "0550 12 34 56", dir: "ltr" }))}
          {field("email", "dash.store.email", input("email", { type: "email", maxLength: 254, dir: "ltr" }))}
          {field("openingHours", "dash.store.hours", input("openingHours", { maxLength: 120, placeholder: t("dash.store.hoursPlaceholder") }))}
        </Section>

        <Section title={t("dash.store.social")} hint={t("dash.store.socialHint")}>
          {field("facebookUrl", "dash.store.facebook", input("facebookUrl", { type: "url", maxLength: 300, placeholder: "https://facebook.com/…", dir: "ltr" }))}
          {field("instagramUrl", "dash.store.instagram", input("instagramUrl", { type: "url", maxLength: 300, placeholder: "https://instagram.com/…", dir: "ltr" }))}
          {field("tiktokUrl", "dash.store.tiktok", input("tiktokUrl", { type: "url", maxLength: 300, placeholder: "https://tiktok.com/@…", dir: "ltr" }))}
        </Section>

        <Section title={t("dash.store.marketing")} hint={t("dash.store.marketingHint")}>
          {field("facebookPixelId", "dash.store.facebookPixel", input("facebookPixelId", { maxLength: 20, placeholder: "123456789012345", dir: "ltr" }))}
          {field("tiktokPixelId", "dash.store.tiktokPixel", input("tiktokPixelId", { maxLength: 30, placeholder: "C4ABCDEFGHIJ12345678", dir: "ltr" }))}
        </Section>

        <Section title={t("dash.store.policies")} hint={t("dash.store.policiesHint")}>
          <div className="grid grid-cols-2 items-end gap-3">
            {field("deliveryDaysMin", "dash.store.deliveryMin", number("deliveryDaysMin", 1))}
            {field("deliveryDaysMax", "dash.store.deliveryMax", number("deliveryDaysMax", 1))}
          </div>
          {field("exchangeDays", "dash.store.exchangeDays", number("exchangeDays", 0), "dash.store.exchangeHint")}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("dash.store.viewPages")}:</span>
            {(
              [
                ["/contact", "footer.contact"],
                ["/delivery-returns", "footer.deliveryReturns"],
                ["/terms", "footer.terms"],
                ["/privacy", "footer.privacy"],
              ] as [string, MessageKey][]
            ).map(([to, label]) => (
              <Link key={to} to={to} target="_blank" className="link-accent inline-flex items-center gap-1">
                {t(label)}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ))}
          </div>
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-3">
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">{children}</div>
    </section>
  );
}
