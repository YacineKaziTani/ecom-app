import { useLocation } from "react-router";
import { MessageCircle } from "lucide-react";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { useI18n } from "../i18n/I18nProvider";
import { whatsappLink } from "../lib/contact";

// Floating "chat on WhatsApp" button, shown once a number is saved in
// Dashboard → Store info. On a product or shop page, the prefilled message
// links to it so the store knows what the question is about.
export function WhatsAppButton() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { data } = useStoreSettings();
  if (!data?.whatsapp) return null;

  const aboutPage = /^\/(?:products|shops)\/[^/]+$/.test(pathname);
  const text = aboutPage
    ? t("whatsapp.messageAbout", { url: window.location.origin + pathname })
    : t("whatsapp.message");

  return (
    <a
      href={whatsappLink(data.whatsapp, text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.button")}
      title={t("whatsapp.button")}
      className="fixed bottom-4 end-4 z-40 flex h-12 w-12 items-center sm:bottom-5 sm:end-5 sm:h-14 sm:w-14 justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25d366] focus-visible:ring-offset-2 focus-visible:ring-offset-background print:hidden"
    >
      <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.2} />
    </a>
  );
}
