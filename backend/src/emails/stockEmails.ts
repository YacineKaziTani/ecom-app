import { email, itemLabel, renderLayout } from "./layout";
import { escapeHtml } from "../utils/escapeHtml";
import { Locale, translator } from "./i18n";
import type { RenderedEmail } from "./orderEmails";
import type { LowStockAlert } from "../services/inventory";


// Sent to a shop owner when a checkout leaves some of their products (or
// product options) at or below the low-stock threshold.
export function lowStockEmail(
  shopName: string,
  alerts: LowStockAlert[],
  link: string,
  locale: Locale = "en",
): RenderedEmail {
  const t = translator(locale);
  const end = locale === "ar" ? "left" : "right";
  const left = (a: LowStockAlert) => (a.stock <= 0 ? t("stock.soldOut") : t("stock.left", { count: a.stock }));
  const soldOut = alerts.some((a) => a.stock <= 0);
  const rows = alerts
    .map(
      (a) => `
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e6ede8; color: #374151; font-size: 14px;">${escapeHtml(itemLabel(a))}</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e6ede8; font-size: 14px; text-align: ${end}; font-weight: 600; color: ${a.stock <= 0 ? "#dc2626" : "#b45309"};">${escapeHtml(left(a))}</td>
                    </tr>`,
    )
    .join("");
  const html = renderLayout({
    title: t("stock.title"),
    bodyHtml:
      email.heading(soldOut ? t("stock.headingSoldOut") : t("stock.headingLow")) +
      email.paragraph(t("stock.body", { shop: shopName })) +
      `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 16px;">${rows}
                </table>`,
    cta: { label: t("stock.cta"), url: link },
    locale,
  });
  const text = [
    `${t("stock.title")} — ${shopName}`,
    "",
    ...alerts.map((a) => `${itemLabel(a)}: ${left(a)}`),
    "",
    `${t("stock.cta")}: ${link}`,
  ].join("\n");
  const first = itemLabel(alerts[0]);
  const subject =
    (soldOut ? t("stock.subjectSoldOut", { name: first }) : t("stock.subjectLow", { name: first })) +
    (alerts.length > 1 ? t("stock.andMore", { count: alerts.length - 1 }) : "");
  return { subject, html, text };
}

// Sent to someone who asked to be told when a sold-out product (or option)
// is available again.
// (email.heading / email.paragraph escape the text.)
export function backInStockEmail(name: string, link: string, locale: Locale = "en"): RenderedEmail {
  const t = translator(locale);
  const html = renderLayout({
    title: t("backInStock.title"),
    bodyHtml:
      email.heading(t("backInStock.heading", { name })) +
      email.paragraph(t("backInStock.body", { name })) +
      email.paragraph(t("backInStock.why")),
    cta: { label: t("backInStock.cta"), url: link },
    locale,
  });
  const text = [t("backInStock.heading", { name }), "", t("backInStock.body", { name }), "", `${t("backInStock.cta")}: ${link}`, "", t("backInStock.why")].join("\n");
  return { subject: t("backInStock.subject", { name }), html, text };
}
