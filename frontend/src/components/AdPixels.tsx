import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Cookie } from "lucide-react";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { useI18n } from "../i18n/I18nProvider";
import { adsConsent, CONSENT_EVENT, loadPixels, pixels, setAdsConsent } from "../lib/pixels";

// The visitor's advertising-cookie choice, kept in sync across components.
export function useAdsConsent() {
  const [consent, setConsent] = useState(adsConsent);
  useEffect(() => {
    const update = () => setConsent(adsConsent());
    window.addEventListener(CONSENT_EVENT, update);
    return () => window.removeEventListener(CONSENT_EVENT, update);
  }, []);
  return consent;
}

// Loads the store's pixels once the visitor accepts, counts page views, and
// asks for the choice while there is none. Renders nothing without pixels.
export function AdPixels() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { data: settings } = useStoreSettings();
  const consent = useAdsConsent();
  const ids = { facebook: settings?.facebookPixelId, tiktok: settings?.tiktokPixelId };
  const hasPixels = Boolean(ids.facebook || ids.tiktok);

  useEffect(() => {
    if (hasPixels && consent === "granted") loadPixels(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPixels, consent, ids.facebook, ids.tiktok]);

  useEffect(() => {
    if (hasPixels && consent === "granted") pixels.pageView();
  }, [pathname, hasPixels, consent]);

  if (!hasPixels || consent !== null) return null;
  return (
    <div
      role="dialog"
      aria-label={t("consent.title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.3)] animate-fade-up sm:inset-x-auto sm:bottom-5 sm:start-5 sm:max-w-md sm:rounded-2xl sm:border"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Cookie className="h-4 w-4 text-accent" />
        {t("consent.title")}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("consent.body")}{" "}
        <Link to="/privacy" className="link-accent">
          {t("footer.privacy")}
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setAdsConsent("denied")} className="btn-outline btn-sm flex-1">
          {t("consent.refuse")}
        </button>
        <button type="button" onClick={() => setAdsConsent("granted")} className="btn-primary btn-sm flex-1">
          {t("consent.accept")}
        </button>
      </div>
    </div>
  );
}
