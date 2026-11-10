import { email, renderLayout } from "./layout";
import { Locale, translator } from "./i18n";
import type { RenderedEmail } from "./orderEmails";

function simple(
  locale: Locale,
  subject: string,
  heading: string,
  paragraphs: string[],
  cta?: { label: string; url: string },
): RenderedEmail {
  return {
    subject,
    html: renderLayout({
      title: subject,
      bodyHtml: email.heading(heading) + paragraphs.map(email.paragraph).join(""),
      cta,
      locale,
    }),
    text: [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n"),
  };
}

export function sellerApplicationForAdminEmail(
  applicantName: string,
  shopName: string,
  reviewLink: string,
  locale: Locale = "en",
): RenderedEmail {
  const t = translator(locale);
  return simple(
    locale,
    t("sellerAdmin.subject", { shop: shopName }),
    t("sellerAdmin.heading"),
    [t("sellerAdmin.body", { name: applicantName, shop: shopName })],
    { label: t("sellerAdmin.cta"), url: reviewLink },
  );
}

export function sellerApplicationDecisionEmail(
  approved: boolean,
  name: string,
  shopName: string,
  link: string,
  note?: string | null,
  locale: Locale = "en",
): RenderedEmail {
  const t = translator(locale);
  if (approved) {
    return simple(
      locale,
      t("sellerOk.subject", { shop: shopName }),
      t("sellerOk.heading", { name }),
      [t("sellerOk.body", { shop: shopName }), ...(note ? [note] : [])],
      { label: t("sellerOk.cta"), url: link },
    );
  }
  return simple(locale, t("sellerNo.subject"), t("account.hi", { name }), [
    t("sellerNo.body", { shop: shopName }),
    ...(note ? [t("sellerNo.reason", { note })] : []),
    t("sellerNo.again"),
  ]);
}

export function verifyEmailEmail(name: string, link: string, locale: Locale = "en"): RenderedEmail {
  const t = translator(locale);
  return simple(
    locale,
    t("verify.subject"),
    t("account.hi", { name }),
    [t("verify.body"), t("verify.expires")],
    { label: t("verify.cta"), url: link },
  );
}
