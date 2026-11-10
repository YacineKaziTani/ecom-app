import { Loader2 } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

// Shown while a lazily-loaded page's code is downloading.
export function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
