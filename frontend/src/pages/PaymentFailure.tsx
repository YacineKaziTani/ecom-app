import { useSearchParams, Link } from "react-router";
import { XCircle } from "lucide-react";
import { useAuth } from "../store/AuthContext";

export default function PaymentFailure() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const emailFromUrl = searchParams.get("email");
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <XCircle className="mx-auto h-16 w-16 text-red-500" />
      <h1 className="mt-4 text-2xl font-bold">Payment didn't go through</h1>
      <p className="mt-2">
        Your payment was canceled or declined. Your order hasn't been charged —
        you can try again whenever you're ready.
      </p>

      {orderId && (
        <Link
          to={
            user
              ? "/orders"
              : `/order-confirmation/${orderId}${emailFromUrl ? `?email=${encodeURIComponent(emailFromUrl)}` : ""}`
          }
          className="btn-primary mt-6 inline-flex"
        >
          {user ? "View my orders" : "View order & retry payment"}
        </Link>
      )}
    </div>
  );
}
