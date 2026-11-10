import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, Loader2 } from "lucide-react";
import { authApi } from "../api/auth";
import { AuthLayout } from "../components/AuthLayout";
import toast from "react-hot-toast";
import { useI18n } from "../i18n/I18nProvider";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (mutation.isSuccess) {
    return (
      <AuthLayout
        title={t("forgot.checkInbox")}
        subtitle={t("forgot.onItsWay")}
      >
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <MailCheck className="h-6 w-6 text-success" />
          </span>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {t("forgot.sentTo", { email })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("forgot.expires")}
          </p>

          <Link to="/login" className="btn-outline mt-6 w-full">
            {t("forgot.backToSignIn")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {t("forgot.remembered")}{" "}
          <Link to="/login" className="link-accent">
            {t("forgot.signIn")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            {t("forgot.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
          <p className="field-hint">
            {t("forgot.emailHint")}
          </p>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary btn-lg w-full"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t("forgot.sending") : t("forgot.send")}
        </button>
      </form>
    </AuthLayout>
  );
}
