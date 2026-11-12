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
import { phoneVerificationApi } from "../api/phoneVerification";
import { ApiError } from "../api/client";
import { DeliveryType, PaymentMethod } from "../api/types";
import { formatPrice } from "../lib/status";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";
import { keyOf, lineKey, linePrice } from "../lib/cart";
import { addressesApi } from "../api/addresses";
import { Address } from "../api/types";
import { useAddresses } from "../components/AddressBook";
import { CommuneSelect } from "../components/CommuneSelect";

// "+213 550 12-34-56" and "0550123456" are the same number.
const samePhone = (a: string, b: string) => {
  const norm = (v: string) => v.replace(/[\s.-]/g, "").replace(/^(?:\+213|00213)/, "0");
  return norm(a) === norm(b);
};

interface StockIssue {
  productId: string;
  productName?: string;
  variantId?: string | null;
  variantName?: string | null;
  availableStock: number;
  requestedQuantity: number;
}

const toItem = (l: { product: { id: string }; variant?: { id: string } | null; quantity: number }) => ({
  productId: l.product.id,
  variantId: l.variant?.id ?? null,
  quantity: l.quantity,
});

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
  // Optional SMS check for larger pay-on-delivery orders (store setting).
  const [phoneCode, setPhoneCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  // The server's total decides; if it asks for a code the cart's own estimate
  // (e.g. a stale guest-cart price) missed, show the code box anyway.
  const [codeRequiredByServer, setCodeRequiredByServer] = useState(false);
  // Signed-in customers pick from their address book (default pre-selected),
  // and can save a new address after ordering.
  const [addressId, setAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, tp, lang } = useI18n();
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

  const { data: savedAddresses } = useAddresses(!!user);
  function applySaved(a: Address) {
    setAddressId(a.id);
    setPhone(a.phone);
    setWilayaCode(a.wilayaCode);
    setCommune(a.commune);
    setAddress(a.address);
  }
  const defaultAddress = savedAddresses?.find((a) => a.isDefault) ?? savedAddresses?.[0];
  useEffect(() => {
    // Only fill an untouched form.
    if (defaultAddress && !addressId && !commune && !address) applySaved(defaultAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAddress?.id]);
  // The saved address the form currently shows, if any.
  const matchedId =
    savedAddresses?.find(
      (a) =>
        a.wilayaCode === wilayaCode &&
        a.commune.trim() === commune.trim() &&
        a.address.trim() === address.trim() &&
        samePhone(a.phone, phone),
    )?.id ?? "";
  const matchesSaved = matchedId !== "";
  const canSaveAddress = !!user && !matchesSaved && (savedAddresses?.length ?? 0) < 10;

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

  const sendCode = useMutation({
    mutationFn: () => phoneVerificationApi.request(phone),
    onSuccess: () => setCodeSentTo(phone),
    onError: (err: any) => toast.error(String(err)),
  });

  const couponMutation = useMutation({
    mutationFn: () =>
      couponsApi.validate(
        couponInput,
        lines.map(toItem),
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
      if (canSaveAddress && saveAddress && wilayaCode !== "") {
        // Best effort: the order is placed either way.
        addressesApi
          .create({ label: commune.trim().slice(0, 40), phone, wilayaCode, commune, address })
          .then(() => qc.invalidateQueries({ queryKey: ["addresses"] }))
          .catch(() => undefined);
      }

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
          const key = lineKey(issue.productId, issue.variantId);
          issueMap[key] = issue;
          if (issue.availableStock > 0) {
            setQuantity(key, issue.availableStock);
          } else {
            removeItem(key);
          }
        }
        setStockIssues(issueMap);
        setAppliedCoupon(null); // cart contents changed — the discount preview is now stale, re-apply if desired

        toast.error(t("cart.stockChanged"), { duration: 6000 });
      } else if (err?.data?.code === "VARIANT_REQUIRED") {
        // A product gained options after it was put in the cart.
        toast.error(t("cart.chooseOption"), { duration: 6000 });
        const productId: string | undefined = err.data.productId;
        if (productId) navigate(`/products/${productId}`);
      } else if (err?.data?.code === "COD_BLOCKED") {
        toast.error(t("cart.codBlocked"), { duration: 6000 });
        if (cardAvailable) setPaymentMethod("card");
      } else if (err?.data?.code === "PHONE_CODE_REQUIRED") {
        setCodeRequiredByServer(true);
        toast.error(t("cart.codeRequired"));
      } else if (err?.data?.code === "PHONE_CODE_INVALID") {
        toast.error(t("cart.codeInvalid"));
      } else if (err?.data?.code === "COMMUNE_INVALID") {
        setCommune("");
        toast.error(t("cart.communeInvalid"));
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
      phoneCode: needsCode && phoneCode ? phoneCode.trim() : undefined,
      items: lines.map(toItem),
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
  const otpMin = config?.codOtpMinTotal ?? null;
  const needsCode = method === "cod" && otpMin !== null && (grandTotal >= otpMin || codeRequiredByServer);
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
          {lines.map((line) => {
            const { product, variant, quantity } = line;
            const key = keyOf(line);
            const issue = stockIssues[key];
            const price = linePrice(line);
            return (
              <div
                key={key}
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
                  {variant && (
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {t("product.option", { name: variant.name })}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t("cart.each", { price: formatPrice(price) })}
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
                      setQuantity(key, Math.max(1, quantity - 1))
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
                    onClick={() => setQuantity(key, quantity + 1)}
                    className="icon-btn h-7 w-7 p-0"
                    aria-label={t("product.increase")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="w-28 text-end font-serif text-lg font-bold text-foreground">
                  {formatPrice(price * quantity)}
                </p>

                <button
                  onClick={() => removeItem(key)}
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

            {user && !!savedAddresses?.length && (
              <div>
                <label htmlFor="savedAddress" className="label">
                  {t("cart.savedAddress")}
                </label>
                <select
                  id="savedAddress"
                  value={matchedId}
                  onChange={(e) => {
                    const chosen = savedAddresses.find((a) => a.id === e.target.value);
                    if (chosen) applySaved(chosen);
                    else setAddressId("");
                  }}
                  className="select"
                >
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.commune}
                    </option>
                  ))}
                  <option value="">{t("cart.newAddress")}</option>
                </select>
              </div>
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

            {needsCode && (
              <div className="rounded-lg border border-info/30 bg-info-soft p-3">
                <p className="text-xs text-info">{t("cart.codeHint", { amount: formatPrice(otpMin!) })}</p>
                <div className="mt-2 flex gap-2">
                  <input
                    id="phoneCode"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    aria-label={t("cart.phoneCode")}
                    className="input flex-1 font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => (phone.trim() ? sendCode.mutate() : toast.error(t("cart.enterPhoneFirst")))}
                    disabled={sendCode.isPending}
                    className="btn-outline whitespace-nowrap"
                  >
                    {codeSentTo ? t("cart.resendCode") : t("cart.sendCode")}
                  </button>
                </div>
                {codeSentTo && <p className="mt-1.5 text-xs text-muted-foreground">{t("cart.codeSent", { phone: codeSentTo })}</p>}
              </div>
            )}

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
                  {
                    setWilayaCode(e.target.value ? Number(e.target.value) : "");
                    setCommune(""); // communes belong to a wilaya
                  }
                  }
                  className="select"
                >
                  <option value="">{t("cart.choose")}</option>
                  {zones?.map((z) => (
                    <option key={z.code} value={z.code} disabled={!z.isActive}>
                      {String(z.code).padStart(2, "0")} — {lang === "ar" && z.nameAr ? z.nameAr : z.name}
                      {!z.isActive ? ` ${t("cart.notDelivered")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="commune" className="label">
                  {t("cart.commune")}
                </label>
                <CommuneSelect id="commune" required wilayaCode={wilayaCode} value={commune} onChange={setCommune} />
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
              {canSaveAddress && (
                <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {t("cart.saveAddress")}
                </label>
              )}
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
