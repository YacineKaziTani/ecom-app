import { useState, useRef, useEffect, FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
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
  Banknote,
  CreditCard,
  Truck,
  Store,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../store/AuthContext";
import { ordersApi, CreateOrderInput } from "../api/orders";
import { paymentsApi } from "../api/payments";
import { couponsApi, CouponPreview } from "../api/coupons";
import { shippingApi } from "../api/shipping";
import { configApi } from "../api/config";
import { ApiError } from "../api/client";
import { DeliveryType, PaymentMethod } from "../api/types";
import { formatPrice } from "../lib/status";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";

interface StockIssue {
  productId: string;
  productName?: string;
  availableStock: number;
  requestedQuantity: number;
}

export default function Cart() {
  const { lines, removeItem, setQuantity, total, clear } = useCart();
  const { user } = useAuth();
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [wilayaCode, setWilayaCode] = useState<number | "">(user?.wilayaCode ?? "");
  const [commune, setCommune] = useState(user?.commune || "");
  const [address, setAddress] = useState(user?.address || "");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("home");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [stockIssues, setStockIssues] = useState<Record<string, StockIssue>>({});
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, tp } = useI18n();
  useDocumentMeta(t("cart.title"));

  // The session can finish loading after the first render — pre-fill the
  // delivery form from the saved profile once it's there (never overwriting
  // anything the customer already typed).
  useEffect(() => {
    if (!user) return;
    setPhone((v) => v || user.phone || "");
    setWilayaCode((v) => (v === "" ? user.wilayaCode ?? "" : v));
    setCommune((v) => v || user.commune || "");
    setAddress((v) => v || user.address || "");
  }, [user]);

  const { data: zones } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: shippingApi.zones,
    staleTime: 5 * 60 * 1000,
  });
  const { data: config } = useQuery({
    queryKey: ["store-config"],
    queryFn: configApi.get,
    staleTime: 5 * 60 * 1000,
  });
  const cardAvailable = config?.paymentMethods.includes("card") ?? false;
  const method: PaymentMethod = cardAvailable ? paymentMethod : "cod";

  const zone = zones?.find((z) => z.code === wilayaCode);
  const deskAvailable = zone?.deskPrice != null;
  const delivery: DeliveryType = deskAvailable ? deliveryType : "home";
  const shippingFee = zone
    ? delivery === "desk"
      ? zone.deskPrice!
      : zone.homePrice
    : null;

  const couponMutation = useMutation({
    mutationFn: () =>
      couponsApi.validate(
        couponInput,
        lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      ),
    onSuccess: (preview) => {
      setAppliedCoupon(preview);
      toast.success(
        t("cart.couponApplied", { amount: formatPrice(preview.discountAmount) }),
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

  function goToConfirmation(order: { id: string; guestEmail?: string }, state?: unknown) {
    const query = order.guestEmail
      ? `?email=${encodeURIComponent(order.guestEmail)}`
      : "";
    navigate(`/order-confirmation/${order.id}${query}`, { state });
  }

  const mutation = useMutation({
    mutationFn: (data: CreateOrderInput) =>
      ordersApi.create(data, idempotencyKeyRef.current!),
    onSuccess: async (order) => {
      clear();
      setStockIssues({});
      setAppliedCoupon(null);
      qc.invalidateQueries({ queryKey: ["orders"] });

      if (order.paymentMethod === "cod") {
        toast.success(t("cart.placedCod"));
        goToConfirmation(order, { order });
        return;
      }

      try {
        const { checkoutUrl } = await paymentsApi.createCheckout(
          order.id,
          order.guestEmail,
        );
        window.location.href = checkoutUrl;
      } catch {
        toast.error(
          t("cart.paymentStartFailed"),
        );
        goToConfirmation(order, { order });
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

        toast.error(t("cart.stockChanged"), { duration: 6000 });
      } else {
        toast.error(String(err));
      }
    },
  });

  function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (wilayaCode === "") {
      toast.error(t("cart.chooseWilayaError"));
      return;
    }
    setStockIssues({});
    mutation.mutate({
      paymentMethod: method,
      phone,
      wilayaCode,
      commune,
      deliveryType: delivery,
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
          title={t("cart.emptyTitle")}
          description={t("cart.emptyBody")}
          action={
            <Link to="/" className="btn-primary">
              <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
              {t("common.continueShopping")}
            </Link>
          }
        />
      </div>
    );
  }

  const subtotal = total();
  const discount = appliedCoupon?.discountAmount ?? 0;
  const grandTotal = Math.max(subtotal - discount, 0) + (shippingFee ?? 0);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("cart.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tp("cart.ready", itemCount)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
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
                      src={optimizedImage(product.imageUrl, 160)}
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
                    {t("cart.each", { price: formatPrice(product.price) })}
                  </p>
                  {issue && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {t("cart.onlyLeftUpdated", { count: issue.availableStock })}
                    </p>
                  )}
                </div>

                <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                  <button
                    onClick={() =>
                      setQuantity(product.id, Math.max(1, quantity - 1))
                    }
                    className="icon-btn h-7 w-7 p-0"
                    aria-label={t("product.decrease")}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-semibold tabular-nums text-foreground">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(product.id, quantity + 1)}
                    className="icon-btn h-7 w-7 p-0"
                    aria-label={t("product.increase")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="w-28 text-end font-serif text-lg font-bold text-foreground">
                  {formatPrice(Number(product.price) * quantity)}
                </p>

                <button
                  onClick={() => removeItem(product.id)}
                  className="icon-btn-danger"
                  aria-label={t("cart.remove", { name: product.name })}
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
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {t("common.continueShopping")}
          </Link>
        </div>

        {/* Summary + checkout ------------------------------------ */}
        <div className="card sticky top-24 overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-6 py-4">
            <h2 className="font-serif text-lg font-bold text-foreground">
              {t("cart.summary")}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("cart.subtotal")}</span>
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
                    className="ms-1 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
                    aria-label={t("cart.removeCoupon")}
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
                  placeholder={t("cart.couponPlaceholder")}
                  aria-label={t("cart.couponPlaceholder")}
                  className="input flex-1 font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => couponMutation.mutate()}
                  disabled={!couponInput.trim() || couponMutation.isPending}
                  className="btn-outline"
                >
                  {couponMutation.isPending ? t("cart.checking") : t("cart.apply")}
                </button>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("cart.delivery")}</span>
              <span className="font-medium text-foreground">
                {shippingFee == null
                  ? t("cart.chooseWilaya")
                  : shippingFee === 0
                    ? t("common.free")
                    : formatPrice(shippingFee)}
              </span>
            </div>

            <div className="divider" />

            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-foreground">{t("cart.total")}</span>
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
                    {t("cart.fullName")}
                  </label>
                  <input
                    id="guestName"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="input"
                    placeholder="Amina Benali"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label htmlFor="guestEmail" className="label">
                    {t("cart.email")}
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <p className="field-hint">
                    {t("cart.emailHint")}{" "}
                    <Link to="/login" className="link-accent">
                      {t("cart.signInInstead")}
                    </Link>{" "}
                    {t("cart.signInHint")}
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="phone" className="label">
                {t("cart.phone")}
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0550 12 34 56"
                autoComplete="tel"
              />
              <p className="field-hint">
                {t("cart.phoneHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wilaya" className="label">
                  {t("cart.wilaya")}
                </label>
                <select
                  id="wilaya"
                  required
                  value={wilayaCode}
                  onChange={(e) =>
                    setWilayaCode(e.target.value ? Number(e.target.value) : "")
                  }
                  className="select"
                >
                  <option value="">{t("cart.choose")}</option>
                  {zones?.map((z) => (
                    <option key={z.code} value={z.code} disabled={!z.isActive}>
                      {String(z.code).padStart(2, "0")} — {z.name}
                      {!z.isActive ? ` ${t("cart.notDelivered")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="commune" className="label">
                  {t("cart.commune")}
                </label>
                <input
                  id="commune"
                  required
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="input"
                  placeholder="Bab Ezzouar"
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="label">
                {t("cart.address")}
              </label>
              <textarea
                id="address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="textarea"
                placeholder={t("cart.addressPlaceholder")}
                autoComplete="street-address"
              />
            </div>

            {zone && (
              <fieldset>
                <legend className="label">{t("cart.deliveryLegend")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceCard
                    selected={delivery === "home"}
                    onSelect={() => setDeliveryType("home")}
                    icon={Truck}
                    title={t("cart.toDoor")}
                    detail={zone.homePrice === 0 ? t("common.free") : formatPrice(zone.homePrice)}
                  />
                  <ChoiceCard
                    selected={delivery === "desk"}
                    onSelect={() => setDeliveryType("desk")}
                    disabled={!deskAvailable}
                    icon={Store}
                    title={t("cart.stopDesk")}
                    detail={
                      deskAvailable
                        ? zone.deskPrice === 0
                          ? t("common.free")
                          : formatPrice(zone.deskPrice!)
                        : t("cart.notOffered")
                    }
                  />
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="label">{t("cart.payment")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard
                  selected={method === "cod"}
                  onSelect={() => setPaymentMethod("cod")}
                  icon={Banknote}
                  title={t("cart.cod")}
                  detail={t("cart.codHint")}
                />
                <ChoiceCard
                  selected={method === "card"}
                  onSelect={() => setPaymentMethod("card")}
                  disabled={!cardAvailable}
                  icon={CreditCard}
                  title={t("cart.online")}
                  detail={cardAvailable ? "EDAHABIA / CIB" : t("cart.unavailable")}
                />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary btn-lg w-full"
            >
              {method === "card" ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              {mutation.isPending
                ? method === "card"
                  ? t("cart.redirecting")
                  : t("cart.placing")
                : method === "card"
                  ? t("cart.continueToPayment")
                  : t("cart.placeOrder")}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {method === "card"
                ? t("cart.redirectNote")
                : t("cart.codNote", { amount: formatPrice(grandTotal) })}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  disabled,
  icon: Icon,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: typeof Truck;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-card hover:border-accent/50",
      )}
    >
      <Icon className={cn("h-4 w-4", selected ? "text-accent" : "text-muted-foreground")} />
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}
