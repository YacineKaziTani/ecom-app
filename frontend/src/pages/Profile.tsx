import { useState, FormEvent, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { authApi } from "../api/auth";
import { useAuth, useInvalidateAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { TwoFactorCard } from "../components/TwoFactorCard";
import { AddressBook } from "../components/AddressBook";
import { roleBadge, formatDate } from "../lib/status";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  useDocumentMeta(t("profile.title"));
  const invalidateAuth = useInvalidateAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });

  useEffect(() => {
    if (user) {
      setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || "" });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: () => {
      invalidateAuth();
      toast.success(t("profile.updated"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
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
            {t("profile.memberSince", { date: formatDate(user.createdAt) })}
          </p>
        </div>

        <span className={roleBadge[user.role]}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {t(`role.${user.role}`)}
        </span>
      </div>

      {/* Editable details --------------------------------------- */}
      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-6 py-4">
          <h2 className="font-serif text-lg font-bold text-foreground">{t("profile.details")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.detailsHint")}</p>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="email" className="label">
              {t("cart.email")}
            </label>
            <input id="email" value={user.email} disabled className="input" />
            <p className="field-hint">{t("profile.emailFixed")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="label">
                {t("profile.firstName")}
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                value={form.firstName}
                onChange={handleChange}
                className="input"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="label">
                {t("profile.lastName")}
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                value={form.lastName}
                onChange={handleChange}
                className="input"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="label">
              {t("cart.phone")}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="input"
              placeholder="0550 12 34 56"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border bg-secondary/30 px-6 py-4">
          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full sm:w-auto">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mutation.isPending ? t("profile.saving") : t("profile.save")}
          </button>
        </div>
      </form>

      <AddressBook />

      {isAdmin && <TwoFactorCard />}
    </div>
  );
}
