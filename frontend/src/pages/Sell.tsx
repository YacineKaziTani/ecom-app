import { useState, FormEvent } from "react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { sellerApplicationsApi } from "../api/sellerApplications";
import { shippingApi } from "../api/shipping";
import { useAuth } from "../store/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import toast from "react-hot-toast";
import { useI18n } from "../i18n/I18nProvider";

// "Sell on ArtisanShop": customers apply here; a super admin approves the
// application, which creates the shop and gives them a seller dashboard.
export default function Sell() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  useDocumentMeta(t("sell.metaTitle"), t("sell.metaDescription"));

  return (
    <div>
      <PageHeader
        variant="hero"
        eyebrow={t("sell.metaTitle")}
        title={t("sell.title")}
        description={t("sell.description")}
      />
      <div className="container-narrow max-w-xl py-10 sm:py-14">
        {!user ? (
          <div className="card space-y-4 p-6 text-center">
            <p className="text-muted-foreground">{t("sell.signInToApply")}</p>
            <div className="flex justify-center gap-3">
              <Link to="/register" className="btn-primary">{t("sell.createAccount")}</Link>
              <Link to="/login" className="btn-outline">{t("sell.signIn")}</Link>
            </div>
          </div>
        ) : isAdmin ? (
          <div className="card space-y-4 p-6 text-center">
            <p className="text-muted-foreground">{t("sell.alreadySeller")}</p>
            <Link to="/dashboard" className="btn-primary">{t("sell.openDashboard")}</Link>
          </div>
        ) : (
          <ApplicationArea emailVerified={!!user.emailVerifiedAt} defaultPhone={user.phone || ""} />
        )}
      </div>
    </div>
  );
}

function ApplicationArea({ emailVerified, defaultPhone }: { emailVerified: boolean; defaultPhone: string }) {
  const { data: application, isLoading } = useQuery({
    queryKey: ["seller-application"],
    queryFn: sellerApplicationsApi.mine,
  });
  const [reapply, setReapply] = useState(false);
  const { t } = useI18n();

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />;

  if (application && !reapply) {
    const status = {
      pending: { icon: Clock, tone: "text-info", title: t("sell.pendingTitle"), body: t("sell.pendingBody") },
      approved: { icon: CheckCircle2, tone: "text-success", title: t("sell.approvedTitle"), body: t("sell.approvedBody") },
      rejected: { icon: XCircle, tone: "text-destructive", title: t("sell.rejectedTitle"), body: application.reviewNote || t("sell.rejectedBody") },
    }[application.status];
    const Icon = status.icon;
    return (
      <div className="card space-y-3 p-6 text-center">
        <Icon className={`mx-auto h-9 w-9 ${status.tone}`} />
        <h2 className="text-xl font-bold text-foreground">{status.title}</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{application.shopName}</strong> — {status.body}
        </p>
        {application.status === "rejected" && (
          <button onClick={() => setReapply(true)} className="btn-outline">{t("sell.applyAgain")}</button>
        )}
      </div>
    );
  }

  if (!emailVerified) {
    return (
      <div className="card p-6 text-center text-sm text-muted-foreground">
        {t("sell.confirmEmailFirst")}
      </div>
    );
  }

  return <ApplicationForm defaultPhone={defaultPhone} onDone={() => setReapply(false)} />;
}

function ApplicationForm({ defaultPhone, onDone }: { defaultPhone: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState({ shopName: "", description: "", phone: defaultPhone, wilayaCode: "", message: "" });
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 300_000 });

  const mutation = useMutation({
    mutationFn: () =>
      sellerApplicationsApi.apply({
        shopName: form.shopName,
        description: form.description || undefined,
        phone: form.phone,
        wilayaCode: form.wilayaCode ? Number(form.wilayaCode) : undefined,
        message: form.message || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller-application"] });
      toast.success(t("sell.sent"));
      onDone();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div className="flex items-center gap-2 text-foreground">
        <Store className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold">{t("sell.formTitle")}</h2>
      </div>
      <div>
        <label htmlFor="shopName" className="label">{t("sell.shopName")}</label>
        <input id="shopName" required value={form.shopName} onChange={set("shopName")} className="input" placeholder="Poterie de Tlemcen" />
      </div>
      <div>
        <label htmlFor="description" className="label">{t("sell.whatYouMake")}</label>
        <textarea id="description" rows={3} value={form.description} onChange={set("description")} className="textarea" placeholder={t("sell.whatYouMakePlaceholder")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="phone" className="label">{t("sell.mobile")}</label>
          <input id="phone" type="tel" required value={form.phone} onChange={set("phone")} className="input" placeholder="0550 12 34 56" />
        </div>
        <div>
          <label htmlFor="wilaya" className="label">{t("sell.wilaya")}</label>
          <select id="wilaya" value={form.wilayaCode} onChange={set("wilayaCode")} className="select">
            <option value="">—</option>
            {zones?.map((z) => (
              <option key={z.code} value={z.code}>{String(z.code).padStart(2, "0")} — {z.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="message" className="label">{t("sell.message")}</label>
        <textarea id="message" rows={3} value={form.message} onChange={set("message")} className="textarea" />
      </div>
      <button type="submit" disabled={mutation.isPending} className="btn-primary btn-lg w-full">
        {mutation.isPending ? t("sell.sending") : t("sell.submit")}
      </button>
    </form>
  );
}
