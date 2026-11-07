import { Link } from "react-router";
import { ShoppingBag } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const columns: { title: MessageKey; links: { to: string; label: MessageKey }[] }[] = [
  {
    title: "footer.shop",
    links: [
      { to: "/", label: "footer.allProducts" },
      { to: "/shops", label: "footer.browseShops" },
      { to: "/cart", label: "footer.yourCart" },
      { to: "/sell", label: "footer.sell" },
    ],
  },
  {
    title: "footer.account",
    links: [
      { to: "/orders", label: "nav.myOrders" },
      { to: "/wishlist", label: "nav.wishlist" },
      { to: "/track-order", label: "footer.trackOrder" },
      { to: "/profile", label: "nav.profile" },
    ],
  },
  {
    title: "footer.access",
    links: [
      { to: "/login", label: "nav.signIn" },
      { to: "/register", label: "footer.createAccount" },
      { to: "/forgot-password", label: "footer.resetPassword" },
    ],
  },
];

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pe-8">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
              </span>
              <span className="font-serif text-xl font-bold tracking-tight text-foreground" dir="ltr">
                Artisan<span className="text-accent">Shop</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                {t(col.title)}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-accent"
                    >
                      {t(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
          <p className="text-xs text-muted-foreground">{t("footer.crafted")}</p>
        </div>
      </div>
    </footer>
  );
}
