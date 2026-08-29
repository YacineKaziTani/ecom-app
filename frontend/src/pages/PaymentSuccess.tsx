import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Clock } from "lucide-react";
import { ordersApi } from "../api/orders";
import { useAuth } from "../store/AuthContext";
import { cn } from "@/lib/utils";

// Chargily redirects the browser here immediately after a successful payment,
// but the *authoritative* confirmation is the separate server-to-server
// webhook — which can arrive a moment before or after this redirect. So this
// page polls the order briefly rather than trusting the redirect alone: if
// paymentStatus is already "paid" great, otherwise it re-checks a few times
// before settling on "still processing, check back shortly".
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 5;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const emailFromUrl = searchParams.get("email"); // present for guest orders — see routes/payments.ts
  const { user } = useAuth();
  const [pollCount, setPollCount] = useState(0);

  const { data: order, refetch } = useQuery({
    queryKey: ["order", orderId, user ? "auth" : emailFromUrl],
    queryFn: () =>
      user ? ordersApi.get(orderId!) : ordersApi.track(orderId!, emailFromUrl!),
    enabled: !!orderId && (!!user || !!emailFromUrl),
  });

  useEffect(() => {
    if (!order || order.paymentStatus !== "unpaid") return;
    if (pollCount >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      setPollCount((c) => c + 1);
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [order, pollCount, refetch]);

  const stillWaiting =
    order?.paymentStatus === "unpaid" && pollCount < MAX_POLLS;
  const confirmedPaid = order?.paymentStatus === "paid";

  const state = confirmedPaid
    ? {
        icon: CheckCircle2,
        tone: "bg-success-soft text-success",
        title: "Payment received",
        body: "Thank you — your order is confirmed and being prepared for shipping.",
      }
    : stillWaiting
      ? {
          icon: Loader2,
          tone: "bg-info-soft text-info",
          title: "Confirming your payment…",
          body: "This usually takes just a few seconds. Hang tight.",
          spin: true,
        }
      : {
          icon: Clock,
          tone: "bg-warning-soft text-warning",
          title: "Payment is still processing",
          body: "Your payment was submitted but we haven't had final confirmation yet. This can occasionally take longer — check your order status shortly.",
        };

  const Icon = state.icon;

  return (
    <div className="container-narrow py-16 sm:py-24">
      <div className="mx-auto max-w-md animate-fade-up text-center">
        <span
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
            state.tone,
          )}
        >
          <Icon className={cn("h-8 w-8", state.spin && "animate-spin")} />
        </span>

        <h1 className="mt-6 text-3xl font-bold text-foreground">
          {state.title}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {state.body}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {orderId && (
            <Link
              to={
                user
                  ? "/orders"
                  : `/order-confirmation/${orderId}${emailFromUrl ? `?email=${encodeURIComponent(emailFromUrl)}` : ""}`
              }
              className="btn-primary"
            >
              {user ? "View my orders" : "View order details"}
            </Link>
          )}
          <Link to="/" className="btn-outline">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
