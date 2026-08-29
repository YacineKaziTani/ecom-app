import { useSearchParams, Link } from "react-router";
import { XCircle } from "lucide-react";
import { useAuth } from "../store/AuthContext";

export default function PaymentFailure() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const emailFromUrl = searchParams.get("email");
  const { user } = useAuth();

  return (
    <div className="container-narrow py-16 sm:py-24">
      <div className="mx-auto max-w-md animate-fade-up text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive-soft">
          <XCircle className="h-8 w-8 text-destructive" />
        </span>

        <h1 className="mt-6 text-3xl font-bold text-foreground">
          Payment didn't go through
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Your payment was cancelled or declined, so nothing has been charged.
          Your order is still saved — you can retry whenever you're ready.
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
              {user ? "View my orders" : "View order & retry payment"}
            </Link>
          )}
          <Link to="/cart" className="btn-outline">
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  );
}
