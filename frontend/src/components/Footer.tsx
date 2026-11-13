import { Link } from "react-router";
import { BrandMark, Wordmark } from "./Brand";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { setAdsConsent } from "../lib/pixels";

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
    title: "footer.help",
    links: [
      { to: "/contact", label: "footer.contact" },
      { to: "/delivery-returns", label: "footer.deliveryReturns" },
      { to: "/terms", label: "footer.terms" },
      { to: "/privacy", label: "footer.privacy" },
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
  const { data: settings } = useStoreSettings();
  const hasPixels = Boolean(settings?.facebookPixelId || settings?.tiktokPixelId);
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-page py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1 lg:pe-8">
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark />
              <Wordmark className="text-xl" />
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
          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            {hasPixels && (
              // Asks the advertising-cookie question again.
              <button type="button" onClick={() => setAdsConsent(null)} className="hover:text-accent">
                {t("consent.manage")}
              </button>
            )}
            <span>{t("footer.crafted")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
