import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, Loader2 } from "lucide-react";
import { authApi } from "../api/auth";
import { AuthLayout } from "../components/AuthLayout";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");

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
        title="Check your inbox"
        subtitle="If an account exists for that address, a reset link is on its way."
      >
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <MailCheck className="h-6 w-6 text-success" />
          </span>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            We've sent a password reset link to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The link expires in one hour. Don't forget to check your spam
            folder.
          </p>

          <Link to="/login" className="btn-outline mt-6 w-full">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to set a new password."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="link-accent">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            Email address
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
            We'll send a secure reset link to this address.
          </p>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary btn-lg w-full"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthLayout>
  );
}
