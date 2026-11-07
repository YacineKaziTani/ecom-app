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

// "Sell on ArtisanShop": customers apply here; a super admin approves the
// application, which creates the shop and gives them a seller dashboard.
export default function Sell() {
  const { user, isAdmin } = useAuth();
  useDocumentMeta("Sell on ArtisanShop", "Open your own shop and reach customers across all 58 wilayas.");

  return (
    <div>
      <PageHeader
        variant="hero"
        eyebrow="Sell on ArtisanShop"
        title="Open your own shop"
        description="Reach customers across all 58 wilayas. We handle checkout, payments and order tracking — you focus on making."
      />
      <div className="container-narrow max-w-xl py-10 sm:py-14">
        {!user ? (
          <div className="card space-y-4 p-6 text-center">
            <p className="text-muted-foreground">Create an account (or sign in) to apply.</p>
            <div className="flex justify-center gap-3">
              <Link to="/register" className="btn-primary">Create an account</Link>
              <Link to="/login" className="btn-outline">Sign in</Link>
            </div>
          </div>
        ) : isAdmin ? (
          <div className="card space-y-4 p-6 text-center">
            <p className="text-muted-foreground">You already have seller access.</p>
            <Link to="/dashboard" className="btn-primary">Open your dashboard</Link>
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

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />;

  if (application && !reapply) {
    const status = {
      pending: { icon: Clock, tone: "text-info", title: "Application under review", body: "We'll email you as soon as it's been reviewed." },
      approved: { icon: CheckCircle2, tone: "text-success", title: "Approved!", body: "Sign out and back in to open your seller dashboard." },
      rejected: { icon: XCircle, tone: "text-destructive", title: "Not approved this time", body: application.reviewNote || "You're welcome to apply again." },
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
          <button onClick={() => setReapply(true)} className="btn-outline">Apply again</button>
        )}
      </div>
    );
  }

  if (!emailVerified) {
    return (
      <div className="card p-6 text-center text-sm text-muted-foreground">
        Confirm your email address first — use the link we sent you (or "Resend link" in the banner above).
      </div>
    );
  }

  return <ApplicationForm defaultPhone={defaultPhone} onDone={() => setReapply(false)} />;
}

function ApplicationForm({ defaultPhone, onDone }: { defaultPhone: string; onDone: () => void }) {
  const qc = useQueryClient();
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
      toast.success("Application sent — we'll be in touch soon");
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
        <h2 className="text-lg font-bold">Tell us about your shop</h2>
      </div>
      <div>
        <label htmlFor="shopName" className="label">Shop name</label>
        <input id="shopName" required value={form.shopName} onChange={set("shopName")} className="input" placeholder="Poterie de Tlemcen" />
      </div>
      <div>
        <label htmlFor="description" className="label">What do you make?</label>
        <textarea id="description" rows={3} value={form.description} onChange={set("description")} className="textarea" placeholder="Hand-thrown ceramics, glazed with natural pigments…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="phone" className="label">Mobile number</label>
          <input id="phone" type="tel" required value={form.phone} onChange={set("phone")} className="input" placeholder="0550 12 34 56" />
        </div>
        <div>
          <label htmlFor="wilaya" className="label">Wilaya</label>
          <select id="wilaya" value={form.wilayaCode} onChange={set("wilayaCode")} className="select">
            <option value="">—</option>
            {zones?.map((z) => (
              <option key={z.code} value={z.code}>{String(z.code).padStart(2, "0")} — {z.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="message" className="label">Anything else? (links to your work, social media…)</label>
        <textarea id="message" rows={3} value={form.message} onChange={set("message")} className="textarea" />
      </div>
      <button type="submit" disabled={mutation.isPending} className="btn-primary btn-lg w-full">
        {mutation.isPending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
