import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, ImagePlus, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { homeApi, BannerInput } from "../../api/home";
import { settingsApi } from "../../api/settings";
import { shopsApi } from "../../api/shops";
import type { HomeBanner } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { useI18n, LANGUAGES } from "../../i18n/I18nProvider";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { ImageUpload } from "../../components/ImageUpload";
import { STORE_SETTINGS_KEY, useStoreSettings } from "../../hooks/useStoreSettings";
import { optimizedImage } from "../../lib/images";
import { cn } from "@/lib/utils";

const MAX_BANNERS = 8;

// Super admin: the home page banner slides and the featured artisan.
export default function HomePageAdmin() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HomeBanner | "new" | null>(null);

  const { data: banners } = useQuery({ queryKey: ["home-banners"], queryFn: homeApi.banners, enabled: isSuperAdmin });
  const { data: shops } = useQuery({ queryKey: ["shops"], queryFn: shopsApi.list, enabled: isSuperAdmin });
  const { data: settings } = useStoreSettings();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["home-banners"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  };
  const onError = (err: unknown) => toast.error(String(err));
  const toggle = useMutation({
    mutationFn: (b: HomeBanner) => homeApi.updateBanner(b.id, { isActive: !b.isActive }),
    onSuccess: refresh,
    onError,
  });
  const reorder = useMutation({ mutationFn: homeApi.reorderBanners, onSuccess: refresh, onError });
  const remove = useMutation({
    mutationFn: homeApi.deleteBanner,
    onSuccess: () => {
      refresh();
      toast.success(t("dash.home.deleted"));
    },
    onError,
  });
  const feature = useMutation({
    mutationFn: (featuredShopId: string | null) => settingsApi.update({ featuredShopId }),
    onSuccess: (saved) => {
      qc.setQueryData(STORE_SETTINGS_KEY, saved);
      qc.invalidateQueries({ queryKey: ["home"] });
      toast.success(t("dash.home.featuredSaved"));
    },
    onError,
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title={t("dash.restricted")} description={t("dash.superAdminOnly")} />;
  }

  const list = banners ?? [];
  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((b) => b.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  };
  const langLabel = (code: HomeBanner["lang"]) =>
    code ? LANGUAGES.find((l) => l.code === code)?.label : t("dash.home.allLanguages");

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.store.eyebrow")}
        title={t("dash.home.title")}
        description={t("dash.home.description")}
        actions={
          <Link to="/" target="_blank" className="btn-outline">
            <ExternalLink className="h-4 w-4" />
            {t("dash.home.view")}
          </Link>
        }
      />

      <section className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-6 py-4">
          <div>
            <h2 className="font-semibold text-foreground">{t("dash.home.banners")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("dash.home.bannersHint")}</p>
          </div>
          <button type="button" onClick={() => setEditing("new")} disabled={list.length >= MAX_BANNERS} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            {t("dash.home.add")}
          </button>
        </div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <ImagePlus className="h-8 w-8 text-accent" />
            <p className="max-w-md">{t("dash.home.empty")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((b, i) => (
              <li key={b.id} className={cn("flex flex-wrap items-center gap-4 px-6 py-4", !b.isActive && "opacity-60")}>
                <img src={optimizedImage(b.imageUrl, 240)} alt="" className="h-16 w-28 flex-shrink-0 rounded-lg border border-border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{b.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {langLabel(b.lang)}
                    {b.link && <> · <span dir="ltr">{b.link}</span></>}
                    {!b.isActive && <> · {t("dash.home.hidden")}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} className="icon-btn" aria-label={t("dash.home.moveUp", { title: b.title })}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1 || reorder.isPending} className="icon-btn" aria-label={t("dash.home.moveDown", { title: b.title })}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => toggle.mutate(b)} className="icon-btn" aria-label={t(b.isActive ? "dash.home.hide" : "dash.home.show", { title: b.title })}>
                    {b.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => setEditing(b)} className="icon-btn" aria-label={t("dash.home.edit", { title: b.title })}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(t("dash.home.confirmDelete", { title: b.title })) && remove.mutate(b.id)}
                    className="icon-btn-danger"
                    aria-label={t("dash.home.delete", { title: b.title })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-semibold text-foreground">{t("dash.home.featured")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("dash.home.featuredHint")}</p>
        <label htmlFor="featured-shop" className="label mt-4">{t("dash.home.featuredLabel")}</label>
        <select
          id="featured-shop"
          value={settings?.featuredShopId ?? ""}
          onChange={(e) => feature.mutate(e.target.value || null)}
          disabled={feature.isPending}
          className="select max-w-sm"
        >
          <option value="">{t("dash.home.featuredAuto")}</option>
          {shops?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </section>

      {editing && (
        <BannerModal banner={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </div>
  );
}

function BannerModal({ banner, onClose, onSaved }: { banner: HomeBanner | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    imageUrl: banner?.imageUrl ?? "",
    title: banner?.title ?? "",
    subtitle: banner?.subtitle ?? "",
    ctaLabel: banner?.ctaLabel ?? "",
    link: banner?.link ?? "",
    lang: banner?.lang ?? "",
  });
  const save = useMutation({
    mutationFn: (data: BannerInput) => (banner ? homeApi.updateBanner(banner.id, data) : homeApi.createBanner(data)),
    onSuccess: () => {
      onSaved();
      toast.success(t("dash.home.saved"));
      onClose();
    },
    onError: (err: any) => toast.error(err?.data?.errors?.fieldErrors?.link ? t("dash.home.linkInvalid") : String(err)),
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.imageUrl) return toast.error(t("dash.home.imageRequired"));
    save.mutate({
      imageUrl: form.imageUrl,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      link: form.link.trim() || null,
      lang: (form.lang || null) as BannerInput["lang"],
    });
  }

  return (
    <Modal open onClose={onClose} title={banner ? t("dash.home.editTitle") : t("dash.home.newTitle")} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUpload value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} folder="banners" label={t("dash.home.image")} />
        <p className="-mt-2 text-xs text-muted-foreground">{t("dash.home.imageHint")}</p>
        <div>
          <label htmlFor="banner-title" className="label">{t("dash.home.bannerTitle")}</label>
          <input id="banner-title" required maxLength={120} value={form.title} onChange={set("title")} className="input" />
        </div>
        <div>
          <label htmlFor="banner-subtitle" className="label">{t("dash.home.subtitle")}</label>
          <input id="banner-subtitle" maxLength={240} value={form.subtitle} onChange={set("subtitle")} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="banner-cta" className="label">{t("dash.home.ctaLabel")}</label>
            <input id="banner-cta" maxLength={40} value={form.ctaLabel} onChange={set("ctaLabel")} className="input" placeholder={t("dash.home.ctaPlaceholder")} />
          </div>
          <div>
            <label htmlFor="banner-link" className="label">{t("dash.home.link")}</label>
            <input id="banner-link" maxLength={300} value={form.link} onChange={set("link")} className="input" dir="ltr" placeholder="/shops" />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t("dash.home.linkHint")}</p>
        <div>
          <label htmlFor="banner-lang" className="label">{t("dash.home.language")}</label>
          <select id="banner-lang" value={form.lang} onChange={set("lang")} className="select">
            <option value="">{t("dash.home.allLanguages")}</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
