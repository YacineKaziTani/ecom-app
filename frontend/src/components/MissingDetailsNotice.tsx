import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { StoreSettings } from "../api/types";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { missingDetails } from "../lib/contact";

// Tells a super admin, and only them, that the store details shown on this
// page are incomplete.
export function MissingDetailsNotice({ settings }: { settings: StoreSettings | undefined }) {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  if (!isSuperAdmin || missingDetails(settings).length === 0) return null;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-foreground">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
      <span className="flex-1">{t("legal.adminMissing")}</span>
      <Link to="/dashboard/store-info" className="btn-outline btn-sm">
        {t("legal.adminFill")}
      </Link>
    </div>
  );
}
