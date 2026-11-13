import { useState, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { BellRing, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { productsApi } from "../api/products";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";

// Shown instead of "Add to cart" when the product (or the chosen option) is
// sold out: one email when it's back.
export function StockAlertForm({ productId, variantId }: { productId: string; variantId: string | null }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const target = `${productId}:${variantId ?? ""}`;

  const signUp = useMutation({
    mutationFn: () => productsApi.stockAlert(productId, { email: user ? undefined : email.trim(), variantId }),
    onSuccess: () => setDoneFor(target),
    onError: (err: any) => toast.error(err?.data?.code === "IN_STOCK" ? t("stockAlert.inStock") : String(err)),
  });

  if (doneFor === target) {
    return (
      <p className="mt-8 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
        {t("stockAlert.done", { email: user?.email ?? email.trim() })}
      </p>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signUp.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <BellRing className="h-4 w-4 text-accent" />
        {t("stockAlert.title")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {user ? t("stockAlert.hintSignedIn", { email: user.email }) : t("stockAlert.hint")}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {!user && (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label={t("cart.email")}
            className="input flex-1"
            dir="ltr"
          />
        )}
        <button type="submit" disabled={signUp.isPending} className="btn-primary">
          <BellRing className="h-4 w-4" />
          {t("stockAlert.submit")}
        </button>
      </div>
    </form>
  );
}
