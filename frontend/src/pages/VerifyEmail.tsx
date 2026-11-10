import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { authApi } from "../api/auth";
import { useInvalidateAuth } from "../store/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { useI18n } from "../i18n/I18nProvider";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  // Same defensive extraction as the reset link: always 64 hex chars.
  const token = params.get("token")?.match(/^[a-f0-9]{64}/)?.[0] ?? null;
  const invalidateAuth = useInvalidateAuth();
  const { t } = useI18n();
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
      title={failed ? t("verify.invalidTitle") : mutation.isSuccess ? t("verify.doneTitle") : t("verify.pendingTitle")}
      subtitle={
        failed
          ? t("verify.invalidBody")
          : mutation.isSuccess
            ? t("verify.doneBody")
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
          {t("verify.continue")}
        </Link>
      </div>
    </AuthLayout>
  );
}
