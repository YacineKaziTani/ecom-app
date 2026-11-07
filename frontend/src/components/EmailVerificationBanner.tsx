import { useMutation } from "@tanstack/react-query";
import { useI18n } from "../i18n/I18nProvider";
import { MailWarning } from "lucide-react";
import { authApi } from "../api/auth";
import { useAuth } from "../store/AuthContext";
import toast from "react-hot-toast";

// Nudges signed-in users who haven't confirmed their email yet (needed to
// open a shop or leave reviews).
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { t } = useI18n();
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (data) => toast.success(data.message),
    onError: (err: any) => toast.error(String(err)),
  });

  if (!user || user.emailVerifiedAt) return null;

  return (
    <div className="border-b border-warning/30 bg-warning-soft">
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-warning">
          <MailWarning className="h-4 w-4 flex-shrink-0" />
          {t("verify.banner", { email: user.email })}
        </span>
        <button
          onClick={() => resend.mutate()}
          disabled={resend.isPending || resend.isSuccess}
          className="font-semibold text-warning underline-offset-2 hover:underline disabled:opacity-60"
        >
          {resend.isSuccess ? t("verify.sent") : t("verify.resend")}
        </button>
      </div>
    </div>
  );
}
