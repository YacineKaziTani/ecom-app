import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { authApi } from "../api/auth";
import { useInvalidateAuth } from "../store/AuthContext";
import { AuthLayout } from "../components/AuthLayout";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  // Same defensive extraction as the reset link: always 64 hex chars.
  const token = params.get("token")?.match(/^[a-f0-9]{64}/)?.[0] ?? null;
  const invalidateAuth = useInvalidateAuth();
  const started = useRef(false);

  const mutation = useMutation({
    mutationFn: () => authApi.verifyEmail(token!),
    onSuccess: () => invalidateAuth(),
  });

  // Fire once (React strict mode mounts twice in development).
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      mutation.mutate();
    }
  }, [token, mutation]);

  const failed = !token || mutation.isError;

  return (
    <AuthLayout
      title={failed ? "Link not valid" : mutation.isSuccess ? "Email confirmed" : "Confirming…"}
      subtitle={
        failed
          ? "This confirmation link is invalid or has expired. Sign in and ask for a new one from the banner at the top of the page."
          : mutation.isSuccess
            ? "Thanks — your email address is confirmed."
            : undefined
      }
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {failed ? (
          <XCircle className="h-10 w-10 text-destructive" />
        ) : mutation.isSuccess ? (
          <CheckCircle2 className="h-10 w-10 text-success" />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        )}
        <Link to="/" className="btn-primary">
          Continue to the shop
        </Link>
      </div>
    </AuthLayout>
  );
}
