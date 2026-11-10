import { Link } from "react-router";
import { Compass, ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="animate-fade-up">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft">
          <Compass className="h-7 w-7 text-accent" />
        </span>

        <p className="eyebrow">{t("notFound.eyebrow")}</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-foreground sm:text-5xl">
          {t("notFound.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          {t("notFound.body")}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {t("common.backToShop")}
          </Link>
          <Link to="/shops" className="btn-outline">
            {t("notFound.browseShops")}
          </Link>
        </div>
      </div>
    </div>
  );
}
