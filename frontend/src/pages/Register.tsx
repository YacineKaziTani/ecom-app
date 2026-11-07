import { useState, FormEvent } from "react";
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

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (data) => {
      signedIn(data);
      await mergeGuestCartIntoAccount(qc);
      toast.success("Account created!");
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
    { label: "At least 8 characters", ok: form.password.length >= 8 },
    { label: "Contains a letter", ok: /[a-zA-Z]/.test(form.password) },
    { label: "Contains a number", ok: /\d/.test(form.password) },
  ];

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join ArtisanShop to track orders and check out faster."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="link-accent">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="label">
              First name
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
              Last name
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
            Email address
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
            Password
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
              className="input pr-11"
              required
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
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
