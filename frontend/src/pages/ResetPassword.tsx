import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { authApi } from "../api/auth";
import { AuthLayout } from "../components/AuthLayout";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get("token");
  // Some email clients mangle long plain-text URLs (quoted-printable line
  // wrapping can glue the next word onto the end of the link). The token is
  // always exactly 64 lowercase hex chars, so recover it even if something
  // got appended after it.
  const token = rawToken?.match(/^[a-f0-9]{64}/)?.[0] ?? null;
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(token!, password),
    onSuccess: () => {
      toast.success("Password reset — please sign in");
      navigate("/login");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    mutation.mutate();
  }

  if (!token) {
    return (
      <AuthLayout
        title="Link is incomplete"
        subtitle="This reset link is missing its token."
      >
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive-soft">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </span>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Your email client may have cut the link short. Request a fresh one
            and open it directly from your inbox.
          </p>
          <Link to="/forgot-password" className="btn-primary mt-6 w-full">
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Contains a letter", ok: /[a-zA-Z]/.test(password) },
    { label: "Contains a number", ok: /\d/.test(password) },
    {
      label: "Both entries match",
      ok: password.length > 0 && password === confirmPassword,
    },
  ];

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you haven't used elsewhere."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="link-accent">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="label">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-11"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5
                         text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {password.length > 0 && (
          <ul className="space-y-1">
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

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary btn-lg w-full"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
