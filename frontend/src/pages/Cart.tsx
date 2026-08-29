import { useState, useRef, FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  Trash2,
  Minus,
  Plus,
  AlertTriangle,
  Tag,
  X,
  ShoppingBag,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../store/AuthContext";
import { ordersApi, CreateOrderInput } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { couponsApi, CouponPreview } from "../api/coupons";
import { ApiError } from "../api/client";
import { formatPrice } from "../lib/status";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface StockIssue {
  productId: string;
  productName?: string;
  availableStock: number;
  requestedQuantity: number;
}

export default function Cart() {
  const { lines, removeItem, setQuantity, total, clear } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState(user?.address || "");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [stockIssues, setStockIssues] = useState<Record<string, StockIssue>>({});
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
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
        `Coupon applied — you saved ${formatPrice(preview.discountAmount)}`,
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
      <div className="container-page py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Once you find something you like, it will show up here ready for checkout."
          action={
            <Link to="/" className="btn-primary">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </Link>
          }
        />
      </div>
    );
  }

  const subtotal = total();
  const discount = appliedCoupon?.discountAmount ?? 0;
  const grandTotal = Math.max(subtotal - discount, 0);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Your cart</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
        {/* Line items -------------------------------------------- */}
        <div className="space-y-3">
          {lines.map(({ product, quantity }) => {
            const issue = stockIssues[product.id];
            return (
              <div
                key={product.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors sm:flex-nowrap",
                  issue
                    ? "border-warning/40 bg-warning-soft"
                    : "border-border bg-card shadow-xs",
                )}
              >
                <Link
                  to={`/products/${product.id}`}
                  className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/products/${product.id}`}
                    className="line-clamp-2 font-semibold text-foreground transition-colors hover:text-accent"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatPrice(product.price)} each
                  </p>
                  {issue && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      Only {issue.availableStock} left — quantity updated
                    </p>
                  )}
                </div>

                <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                  <button
                    onClick={() =>
                      setQuantity(product.id, Math.max(1, quantity - 1))
                    }
                    className="icon-btn h-7 w-7 p-0"
                    aria-label={`Decrease quantity of ${product.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-semibold tabular-nums text-foreground">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(product.id, quantity + 1)}
                    className="icon-btn h-7 w-7 p-0"
                    aria-label={`Increase quantity of ${product.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="w-20 text-right font-serif text-lg font-bold text-foreground">
                  {formatPrice(Number(product.price) * quantity)}
                </p>

                <button
                  onClick={() => removeItem(product.id)}
                  className="icon-btn-danger"
                  aria-label={`Remove ${product.name} from cart`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue shopping
          </Link>
        </div>

        {/* Summary ----------------------------------------------- */}
        <div className="card sticky top-24 overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-6 py-4">
            <h2 className="font-serif text-lg font-bold text-foreground">
              Order summary
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">
                {formatPrice(subtotal)}
              </span>
            </div>

            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <Tag className="h-3.5 w-3.5" />
                  {appliedCoupon.code}
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput("");
                    }}
                    className="ml-1 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
                    aria-label="Remove coupon"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
                <span className="font-semibold text-success">
                  −{formatPrice(appliedCoupon.discountAmount)}
                </span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  className="input flex-1 font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => couponMutation.mutate()}
                  disabled={!couponInput.trim() || couponMutation.isPending}
                  className="btn-outline"
                >
                  {couponMutation.isPending ? "Checking…" : "Apply"}
                </button>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium text-muted-foreground">
                Calculated at payment
              </span>
            </div>

            <div className="divider" />

            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-serif text-2xl font-bold text-foreground">
                {formatPrice(grandTotal)}
              </span>
            </div>
          </div>

          <form
            onSubmit={handleCheckout}
            className="space-y-4 border-t border-border bg-secondary/30 px-6 py-5"
          >
            {!user && (
              <>
                <div>
                  <label htmlFor="guestName" className="label">
                    Full name
                  </label>
                  <input
                    id="guestName"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="input"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label htmlFor="guestEmail" className="label">
                    Email
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                  <p className="field-hint">
                    We'll send your order confirmation here.{" "}
                    <Link to="/login" className="link-accent">
                      Sign in
                    </Link>{" "}
                    instead to track orders in your account.
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="address" className="label">
                Shipping address
              </label>
              <textarea
                id="address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="textarea"
                placeholder="Street, city, postal code…"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary btn-lg w-full"
            >
              <Lock className="h-4 w-4" />
              {mutation.isPending
                ? "Redirecting to payment…"
                : "Continue to payment"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Payments are encrypted and processed securely.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
