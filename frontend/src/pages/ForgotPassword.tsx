import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth";
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 ">
      <div className="w-full max-w-md bg-card rounded-lg border border-border">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight"
          >
            ArtisanShop
          </Link>

          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            Reset your password
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        {mutation.isSuccess ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold">Check your inbox</h2>

            <p className="mt-2 text-sm leading-6">
              If an account exists for{" "}
              <span className="font-medium">{email}</span>, we've sent a
              password reset link.
            </p>

            <p className="mt-2 text-xs">The link will expire in one hour.</p>

            <Link
              to="/login"
              className="mt-6 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-mediumtransition hover:bg-brand-50"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="card space-y-6 p-8 shadow-sm"
          >
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email address
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-secondary rounded-lg border border-border focus:outline-none focus:border-accent transition"
                placeholder="you@example.com"
                autoComplete="email"
              />

              <p className="mt-2 text-xs">
                We'll send a secure password reset link to this address.
              </p>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full"
            >
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </span>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          Remembered your password?{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 transition hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-8 text-center text-xs">
          © {new Date().getFullYear()} ArtisanShop. All rights reserved.
        </p>
      </div>
    </div>
  );
}
