import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Clock } from "lucide-react";
import { ordersApi } from "../api/orders";
import { useAuth } from "../store/AuthContext";

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

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {confirmedPaid ? (
        <>
          <CheckCircle2 className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold">Payment received!</h1>
          <p className="mt-2">
            Thank you — your order is confirmed and being prepared.
          </p>
        </>
      ) : stillWaiting ? (
        <>
          <Loader2 className="mx-auto h-16 w-16 animate-spin" />
          <h1 className="mt-4 text-2xl font-bold">
            Confirming your payment...
          </h1>
          <p className="mt-2 text-gray-500">
            This usually takes just a few seconds.
          </p>
        </>
      ) : (
        <>
          <Clock className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold">
            Payment is still processing
          </h1>
          <p className="mt-2">
            Your payment was submitted but we haven't received final
            confirmation yet. This can take a little longer sometimes — check
            your order status shortly.
          </p>
        </>
      )}

      {orderId && (
        <Link
          to={
            user
              ? "/orders"
              : `/order-confirmation/${orderId}${emailFromUrl ? `?email=${encodeURIComponent(emailFromUrl)}` : ""}`
          }
          className="btn-primary mt-6 inline-flex"
        >
          {user ? "View my orders" : "View order details"}
        </Link>
      )}
    </div>
  );
}
