import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import toast from "react-hot-toast";
import { useInvalidateAuth } from "../store/AuthContext";
import { mergeGuestCartIntoAccount } from "../hooks/useCart";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidateAuth = useInvalidateAuth();

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      invalidateAuth();
      qc.clear();
      await mergeGuestCartIntoAccount(qc);
      toast.success("Welcome back!");
      navigate("/");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ email, password });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Link>

        <div className="bg-card rounded-lg border border-border p-8">
          <div className="mb-8">
            <h1 className="font-serif font-bold text-3xl mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">
              Sign in to your Luxora account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 bg-secondary rounded-lg border border-border focus:outline-none focus:border-accent transition"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-secondary rounded-lg border border-border focus:outline-none focus:border-accent transition"
                required
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <Link
                to="/forgot-password"
                className="text-accent hover:text-muted transition"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-accent text-accent-foreground py-2 rounded-lg font-medium hover:bg-muted transition disabled:opacity-50"
            >
              {mutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="text-accent hover:text-muted transition font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
