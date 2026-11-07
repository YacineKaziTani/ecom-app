import { useState, FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { authApi } from "../api/auth";
import { useSignedIn } from "../store/AuthContext";
import { mergeGuestCartIntoAccount } from "../hooks/useCart";
import { AuthLayout } from "../components/AuthLayout";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signedIn = useSignedIn();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (data) => {
      signedIn(data);
      await mergeGuestCartIntoAccount(qc);
      toast.success(t("auth.created"));
      navigate("/");
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

  // Mirrors the backend rule: at least 8 chars, with a letter and a number.
  const rules = [
    { label: t("auth.ruleLength"), ok: form.password.length >= 8 },
    { label: t("auth.ruleLetter"), ok: /[a-zA-Z]/.test(form.password) },
    { label: t("auth.ruleNumber"), ok: /\d/.test(form.password) },
  ];

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="link-accent">
            {t("auth.signIn")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="label">
              {t("auth.firstName")}
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={handleChange}
              placeholder="Jane"
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="label">
              {t("auth.lastName")}
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">
            {t("auth.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="input pe-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5
                         text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {form.password.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {rules.map((rule) => (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    rule.ok ? "text-success" : "text-muted-foreground",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0",
                      rule.ok ? "opacity-100" : "opacity-30",
                    )}
                  />
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary btn-lg w-full"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t("auth.creating") : t("auth.create")}
        </button>
      </form>
    </AuthLayout>
  );
}
