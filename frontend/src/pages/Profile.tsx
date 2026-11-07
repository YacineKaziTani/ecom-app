import { useState, FormEvent, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { shippingApi } from "../api/shipping";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { authApi } from "../api/auth";
import { useAuth, useInvalidateAuth } from "../store/AuthContext";
import { TwoFactorCard } from "../components/TwoFactorCard";
import { roleBadge, formatDate } from "../lib/status";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const invalidateAuth = useInvalidateAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    wilayaCode: "" as number | "",
    commune: "",
  });

  const { data: zones } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: shippingApi.zones,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || "",
        address: user.address || "",
        wilayaCode: user.wilayaCode ?? "",
        commune: user.commune || "",
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: () => {
      invalidateAuth();
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      ...form,
      wilayaCode: form.wilayaCode === "" ? null : Number(form.wilayaCode),
      commune: form.commune || null,
    });
  }

  if (!user) return null;

  return (
    // Rendered inside both the public layout and the dashboard, so it keeps its
    // own centred column rather than assuming either shell's padding.
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Identity card ------------------------------------------ */}
      <div className="card mb-6 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-start">
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-xl font-bold uppercase text-brand-700 dark:text-accent">
          {user.firstName?.[0]}
          {user.lastName?.[0]}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{user.email}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Member since {formatDate(user.createdAt)}
          </p>
        </div>

        <span className={roleBadge[user.role]}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {user.role.replace("_", " ")}
        </span>
      </div>

      {/* Editable details --------------------------------------- */}
      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-6 py-4">
          <h2 className="font-serif text-lg font-bold text-foreground">
            Account details
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Used to pre-fill your shipping information at checkout.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input id="email" value={user.email} disabled className="input" />
            <p className="field-hint">
              Your email address can't be changed here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="label">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="label">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="input"
              placeholder="0550 12 34 56"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wilayaCode" className="label">
                Wilaya
              </label>
              <select
                id="wilayaCode"
                name="wilayaCode"
                value={form.wilayaCode}
                onChange={handleChange}
                className="select"
              >
                <option value="">—</option>
                {zones?.map((z) => (
                  <option key={z.code} value={z.code}>
                    {String(z.code).padStart(2, "0")} — {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="commune" className="label">
                Commune
              </label>
              <input
                id="commune"
                name="commune"
                value={form.commune}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="label">
              Default shipping address
            </label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={3}
              className="textarea"
              placeholder="Street, building, floor, landmark…"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border bg-secondary/30 px-6 py-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full sm:w-auto"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {isAdmin && <TwoFactorCard />}
    </div>
  );
}
