import { useMemo } from "react";
import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PageLoader } from "../components/ui/PageLoader";
import { RichText } from "../components/RichText";
import { MissingDetailsNotice } from "../components/MissingDetailsNotice";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { useBrand } from "../hooks/useBrand";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { legalDocument, LegalDoc, LegalVars, MISSING } from "../content/legal";
import { formatPhone } from "../lib/contact";

const PAGES: { doc: LegalDoc; to: string; label: MessageKey }[] = [
  { doc: "terms", to: "/terms", label: "footer.terms" },
  { doc: "delivery", to: "/delivery-returns", label: "footer.deliveryReturns" },
  { doc: "privacy", to: "/privacy", label: "footer.privacy" },
];

// Wraps a store detail in a bidi isolate (U+2068 … U+2069) so a Latin name,
// an RC number or a phone number keeps its own order inside Arabic text.
const isolate = (value: string) => `⁨${value}⁩`;

// Terms of sale, Privacy policy, Delivery and returns: the texts live in
// src/content/legal, filled with the details from Dashboard → Store info.
export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, lang } = useI18n();
  const { data: s, isLoading } = useStoreSettings();
  const { name: brand } = useBrand();

  const vars = useMemo<LegalVars>(
    () => ({
      site: brand,
      legalName: isolate(s?.legalName ?? MISSING),
      registerNumber: isolate(s?.registerNumber ?? MISSING),
      taxId: isolate(s?.taxId ?? MISSING),
      address: isolate(s?.address ?? MISSING),
      email: isolate(s?.email ?? MISSING),
      phone: isolate(s?.phone ? formatPhone(s.phone) : MISSING),
      deliveryMin: s?.deliveryDaysMin ?? 2,
      deliveryMax: s?.deliveryDaysMax ?? 7,
      exchangeDays: s?.exchangeDays ?? 7,
      adPixels: [s?.facebookPixelId && "Meta (Facebook)", s?.tiktokPixelId && "TikTok"].filter((name): name is string => !!name),
    }),
    [s, brand],
  );
  const legal = legalDocument(lang, doc, vars);
  useDocumentMeta(legal.title, legal.intro);
  const missing = t("legal.missing");

  return (
    <div>
      <PageHeader variant="hero" eyebrow={t("legal.eyebrow")} title={legal.title} description={legal.intro} />

      <div className="container-narrow max-w-3xl py-10 sm:py-14">
        <MissingDetailsNotice settings={s} />

        {isLoading ? (
          <PageLoader />
        ) : (
          <article className="space-y-9">
            {legal.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-serif text-xl font-bold text-foreground">{section.heading}</h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/85">
                  {section.body.map((block, i) =>
                    typeof block === "string" ? (
                      <p key={i}>
                        <RichText text={block} missingLabel={missing} />
                      </p>
                    ) : (
                      <ul key={i} className="list-disc space-y-1.5 ps-5 marker:text-accent">
                        {block.list.map((item, j) => (
                          <li key={j}>
                            <RichText text={item} missingLabel={missing} />
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </article>
        )}

        <div className="mt-12 rounded-xl border border-border bg-secondary/40 p-5">
          <p className="text-sm font-semibold text-foreground">{t("legal.seeAlso")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PAGES.filter((page) => page.doc !== doc).map((page) => (
              <Link key={page.doc} to={page.to} className="btn-outline btn-sm">
                {t(page.label)}
              </Link>
            ))}
            <Link to="/contact" className="btn-primary btn-sm">
              <MessageCircle className="h-4 w-4" />
              {t("footer.contact")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
