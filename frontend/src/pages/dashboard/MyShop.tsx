import { useState, FormEvent, useEffect } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, ExternalLink, Info } from "lucide-react";
import { shopsApi, ShopInput } from "../../api/shops";
import { shippingApi } from "../../api/shipping";
import { useAuth } from "../../store/AuthContext";
import { ImageUpload } from "../../components/ImageUpload";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

export default function MyShop() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [form, setForm] = useState<ShopInput>({
    name: "",
    description: "",
    logoUrl: "",
    coverUrl: "",
    story: "",
    wilayaCode: null,
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
  });
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 5 * 60 * 1000 });

  const { data: shop, isLoading } = useQuery({
    queryKey: ["myShop"],
    queryFn: shopsApi.mine,
    retry: false,
    enabled: !isSuperAdmin, // super_admin has no personal shop
  });

  useEffect(() => {
    if (shop)
      setForm({
        name: shop.name,
        description: shop.description || "",
        logoUrl: shop.logoUrl || "",
        coverUrl: shop.coverUrl || "",
        story: shop.story || "",
        wilayaCode: shop.wilayaCode ?? null,
        instagramUrl: shop.instagramUrl || "",
        facebookUrl: shop.facebookUrl || "",
        tiktokUrl: shop.tiktokUrl || "",
      });
  }, [shop]);

  const createMutation = useMutation({
    mutationFn: shopsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myShop"] });
      toast.success(t("dash.shop.created"));
    },
    onError: (err: any) => toast.error(shopError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ShopInput>) => shopsApi.update(shop!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myShop"] });
      toast.success(t("dash.shop.updated"));
    },
    onError: (err: any) => toast.error(shopError(err)),
  });

  // A rejected social link says what's expected instead of "Invalid input".
  function shopError(err: any): string {
    const fields = Object.keys(err?.data?.errors?.fieldErrors ?? {});
    return fields.some((f) => f.endsWith("Url") && f !== "logoUrl" && f !== "coverUrl") ? t("dash.store.err.url") : String(err);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (shop) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  if (isSuperAdmin) {
    return (
      <EmptyState
        icon={Store}
        title={t("dash.shop.noPersonalTitle")}
        description={t("dash.shop.noPersonalBody")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={t("dash.shop.eyebrow")}
        title={t("dash.nav.myShop")}
        description={t("dash.shop.description")}
        actions={
          shop ? (
            <Link
              to={`/shops/${shop.slug}`}
              className="btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              {t("dash.shop.viewPublic")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : undefined
        }
      />

      {!shop && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {t("dash.shop.noShopYet")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="name" className="label">
              {t("dash.shop.name")}
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder={t("dash.shop.namePlaceholder")}
            />
            {shop && (
              <p className="field-hint">
                {t("dash.shop.publicUrl")} <span className="font-mono" dir="ltr">/shops/{shop.slug}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              {t("dash.products.descriptionLabel")}
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              className="textarea"
              placeholder={t("dash.shop.descriptionPlaceholder")}
            />
          </div>

          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => setForm({ ...form, logoUrl: url })}
            folder="shops"
            label={t("dash.shop.logo")}
          />
        </div>

        {/* Shop page profile */}
        <div className="space-y-5 border-t border-border p-6">
          <div>
            <h2 className="font-semibold text-foreground">{t("dash.shop.profile")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("dash.shop.profileHint")}</p>
          </div>
          <ImageUpload
            value={form.coverUrl}
            onChange={(url) => setForm({ ...form, coverUrl: url })}
            folder="shops"
            label={t("dash.shop.cover")}
          />
          <p className="-mt-3 text-xs text-muted-foreground">{t("dash.shop.coverHint")}</p>
          <div>
            <label htmlFor="story" className="label">{t("dash.shop.story")}</label>
            <textarea
              id="story"
              value={form.story}
              onChange={(e) => setForm({ ...form, story: e.target.value })}
              rows={6}
              maxLength={3000}
              className="textarea"
              placeholder={t("dash.shop.storyPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="shop-wilaya" className="label">{t("dash.shop.wilaya")}</label>
            <select
              id="shop-wilaya"
              value={form.wilayaCode ?? ""}
              onChange={(e) => setForm({ ...form, wilayaCode: e.target.value ? Number(e.target.value) : null })}
              className="select"
            >
              <option value="">{t("cart.choose")}</option>
              {zones?.map((z) => (
                <option key={z.code} value={z.code}>
                  {String(z.code).padStart(2, "0")} — {lang === "ar" && z.nameAr ? z.nameAr : z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["instagramUrl", "Instagram", "https://instagram.com/…"],
                ["facebookUrl", "Facebook", "https://facebook.com/…"],
                ["tiktokUrl", "TikTok", "https://tiktok.com/@…"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key}>
                <label htmlFor={`shop-${key}`} className="label">{label}</label>
                <input
                  id={`shop-${key}`}
                  type="url"
                  dir="ltr"
                  maxLength={300}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="input"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-border bg-secondary/30 px-6 py-4">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full sm:w-auto"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {shop ? t("dash.products.save") : t("dash.products.createShop")}
          </button>
        </div>
      </form>
    </div>
  );
}
