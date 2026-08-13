import { useState, useRef, FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Trash2, Minus, Plus, AlertTriangle, Tag, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "../store/cartStore";
import { useAuth } from "../store/AuthContext";
import { ordersApi, CreateOrderInput } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { couponsApi, CouponPreview } from "../api/coupons";
import { ApiError } from "../api/client";
import toast from "react-hot-toast";

interface StockIssue {
  productId: string;
  productName?: string;
  availableStock: number;
  requestedQuantity: number;
}

export default function Cart() {
  const { lines, removeItem, setQuantity, total, clear } = useCartStore();
  const { user } = useAuth();
  const [address, setAddress] = useState(user?.address || "");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [stockIssues, setStockIssues] = useState<Record<string, StockIssue>>(
    {},
  );
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(
    null,
  );
  const navigate = useNavigate();
  const qc = useQueryClient();

  const couponMutation = useMutation({
    mutationFn: () =>
      couponsApi.validate(
        couponInput,
        lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      ),
    onSuccess: (preview) => {
      setAppliedCoupon(preview);
      toast.success(
        `Coupon applied — you saved $${preview.discountAmount.toFixed(2)}`,
      );
    },
    onError: (err: any) => {
      setAppliedCoupon(null);
      toast.error(String(err) || "Invalid coupon code");
    },
  });

  const idempotencyKeyRef = useRef<string>();
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const mutation = useMutation({
    mutationFn: (data: CreateOrderInput) =>
      ordersApi.create(data, idempotencyKeyRef.current!),
    onSuccess: async (order) => {
      clear();
      setStockIssues({});
      setAppliedCoupon(null);
      qc.invalidateQueries({ queryKey: ["orders"] });

      try {
        const { checkoutUrl } = await paymentsApi.createCheckout(order.id);
        window.location.href = checkoutUrl;
      } catch (err) {
        toast.error(
          "Order placed, but we couldn't start the payment step — you can retry from there.",
        );
        const query = order.guestEmail
          ? `?email=${encodeURIComponent(order.guestEmail)}`
          : "";
        navigate(`/order-confirmation/${order.id}${query}`, {
          state: { order },
        });
      }
    },
    onError: (err: any) => {
      const issues: StockIssue[] | undefined =
        err instanceof ApiError ? err.data?.issues : undefined;

      if (issues && issues.length > 0) {
        // Auto-correct the cart: clamp quantity down to what's actually available,
        // or drop the line entirely if a product vanished or sold out completely.
        const issueMap: Record<string, StockIssue> = {};
        for (const issue of issues) {
          issueMap[issue.productId] = issue;
          if (issue.availableStock > 0) {
            setQuantity(issue.productId, issue.availableStock);
          } else {
            removeItem(issue.productId);
          }
        }
        setStockIssues(issueMap);
        setAppliedCoupon(null); // cart contents changed — the discount preview is now stale, re-apply if desired

        const names = issues.map((i) => i.productName || "an item").join(", ");
        toast.error(
          issues.length === 1
            ? `Only ${issues[0].availableStock} left of "${issues[0].productName}" — updated your cart quantity.`
            : `Stock changed for: ${names}. We've updated your cart — please review before retrying.`,
          { duration: 6000 },
        );
      } else {
        toast.error(String(err));
      }
    },
  });

  function handleCheckout(e: FormEvent) {
    e.preventDefault();
    setStockIssues({});
    mutation.mutate({
      shippingAddress: address,
      guestEmail: user ? undefined : guestEmail,
      guestName: user ? undefined : guestName,
      couponCode: appliedCoupon?.code,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
    });
  }

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400">Your cart is empty.</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Your Cart
        </h1>
        {lines.map(({ product, quantity }) => {
          const issue = stockIssues[product.id];
          return (
            <div
              key={product.id}
              className={`flex items-center gap-4 rounded-lg border p-4 shadow-sm ${
                issue
                  ? "border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  ${Number(product.price).toFixed(2)}
                </p>
                {issue && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    Only {issue.availableStock} left — quantity updated
                  </p>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-border">
                <button
                  onClick={() =>
                    setQuantity(product.id, Math.max(1, quantity - 1))
                  }
                  className="p-1.5 text-foreground transition-colors hover:bg-secondary"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm text-foreground">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(product.id, quantity + 1)}
                  className="p-1.5 text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="w-16 text-right font-semibold text-foreground">
                ${(Number(product.price) * quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeItem(product.id)}
                className="p-2 text-muted-foreground transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="h-fit rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-foreground">Order Summary</h2>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>${total().toFixed(2)}</span>
        </div>

        {appliedCoupon ? (
          <div className="mt-2 flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {appliedCoupon.code}
              <button
                type="button"
                onClick={() => {
                  setAppliedCoupon(null);
                  setCouponInput("");
                }}
                className="ml-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Remove coupon"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
            <span>-${appliedCoupon.discountAmount.toFixed(2)}</span>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Coupon code"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => couponMutation.mutate()}
              disabled={!couponInput.trim() || couponMutation.isPending}
              className="whitespace-nowrap rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {couponMutation.isPending ? "Checking..." : "Apply"}
            </button>
          </div>
        )}

        <div className="my-3 border-t border-border" />
        <div className="flex justify-between font-bold text-foreground">
          <span>Total</span>
          <span>
            $
            {Math.max(
              total() - (appliedCoupon?.discountAmount ?? 0),
              0,
            ).toFixed(2)}
          </span>
        </div>

        <form onSubmit={handleCheckout} className="mt-6 space-y-3">
          {!user && (
            <>
              <label className="block text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                placeholder="Jane Doe"
              />

              <label className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                placeholder="you@example.com"
              />
              <p className="text-xs text-muted-foreground">
                We'll use this to send your order confirmation.{" "}
                <Link
                  to="/login"
                  className="font-medium text-accent hover:underline"
                >
                  Sign in
                </Link>{" "}
                instead to track orders in your account.
              </p>
            </>
          )}

          <label className="block text-sm font-medium text-foreground">
            Shipping address
          </label>
          <textarea
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
            placeholder="Street, city, postal code..."
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending
              ? "Redirecting to payment..."
              : "Continue to payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
