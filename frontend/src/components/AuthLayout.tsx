import { ReactNode } from "react";
import { BrandMark, Wordmark } from "./Brand";
import { useBrand } from "../hooks/useBrand";
import { Link } from "react-router";
import { ArrowLeft, Quote } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Split-screen shell shared by every auth screen: a warm editorial panel on
 * the start side (desktop only) and the form on the other.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useI18n();
  const { name } = useBrand();
  const brand = <Wordmark className="text-xl" />;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel — hidden on small screens where it would just be noise. */}
      <aside className="hero-wash relative hidden w-1/2 flex-col justify-between border-e border-border p-12 lg:flex xl:w-[55%]">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark />
          {brand}
        </Link>

        <div className="max-w-md animate-fade-up">
          <Quote className="h-8 w-8 text-accent/50 rtl:-scale-x-100" />
          <p className="mt-5 font-serif text-2xl font-medium leading-snug text-foreground xl:text-3xl">
            {t("auth.quote")}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">{t("auth.quoteSub")}</p>
        </div>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {name}</p>
      </aside>

      {/* Form side */}
      <main className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {t("common.backToShop")}
          </Link>

          {/* Compact brand mark for mobile, where the panel is hidden. */}
          <Link to="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            {brand}
          </Link>

          <div className="animate-fade-up">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-8 border-t border-border pt-6">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
