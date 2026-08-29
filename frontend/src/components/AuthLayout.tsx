import { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, ShoppingBag, Quote } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Split-screen shell shared by every auth screen: a warm editorial panel on
 * the left (desktop only) and the form on the right.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel — hidden on small screens where it would just be noise. */}
      <aside className="hero-wash relative hidden w-1/2 flex-col justify-between border-r border-border p-12 lg:flex xl:w-[55%]">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">
            Artisan<span className="text-accent">Shop</span>
          </span>
        </Link>

        <div className="max-w-md animate-fade-up">
          <Quote className="h-8 w-8 text-accent/50" />
          <p className="mt-5 font-serif text-2xl font-medium leading-snug text-foreground xl:text-3xl">
            Buy fewer things, but buy things made by someone who cared how they
            turned out.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            Curated goods from independent makers, shipped straight from their
            workshops.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ArtisanShop
        </p>
      </aside>

      {/* Form side */}
      <main className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shop
          </Link>

          {/* Compact brand mark for mobile, where the panel is hidden. */}
          <Link to="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <span className="font-serif text-xl font-bold tracking-tight text-foreground">
              Artisan<span className="text-accent">Shop</span>
            </span>
          </Link>

          <div className="animate-fade-up">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-8 border-t border-border pt-6">{footer}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
