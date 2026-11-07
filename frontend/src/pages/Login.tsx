import { useState, FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { authApi } from "../api/auth";
import { User } from "../api/types";
import { useSignedIn } from "../store/AuthContext";
import { mergeGuestCartIntoAccount } from "../hooks/useCart";
import { AuthLayout } from "../components/AuthLayout";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signedIn = useSignedIn();
  const { t } = useI18n();
  // Set when the account has two-factor sign-in: the password was right, now
  // we need a code from the authenticator app (or a recovery code).
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function finish(data: { user: User }) {
    signedIn(data);
    await mergeGuestCartIntoAccount(qc);
    toast.success(t("auth.welcome"));
    navigate("/");
  }

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      if ("twoFactorRequired" in data) {
        setChallenge(data.challenge);
        return;
      }
      await finish(data);
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const secondStep = useMutation({
    mutationFn: () => authApi.loginSecondStep(challenge!, code),
    onSuccess: finish,
    onError: (err: any) => {
      toast.error(String(err));
      // An expired challenge means starting over with the password.
      if (/timed out/i.test(String(err))) setChallenge(null);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ email, password });
  }

  if (challenge) {
    return (
      <AuthLayout
        title={t("auth.twoStepTitle")}
        subtitle={t("auth.twoStepSubtitle")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            secondStep.mutate();
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="code" className="label">
              {t("auth.code")}
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input text-center font-mono text-lg tracking-[0.3em]"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              placeholder="123456"
            />
          </div>
          <button type="submit" disabled={secondStep.isPending} className="btn-primary btn-lg w-full">
            {secondStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {t("auth.verify")}
          </button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
            }}
            className="btn-ghost w-full"
          >
            {t("auth.otherAccount")}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="link-accent">
            {t("auth.createOne")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="label mb-0">
              {t("auth.password")}
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              {t("auth.forgot")}
            </Link>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary btn-lg w-full"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
    </AuthLayout>
  );
}
