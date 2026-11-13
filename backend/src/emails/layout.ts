import { escapeHtml } from "../utils/escapeHtml";
import { formatDzd } from "../utils/money";
import { Locale, translator } from "./i18n";
import { currentBrand } from "../services/storeSettings";
import { splitWordmark } from "../utils/brand";

// Shared, email-client-safe (table based, inline styles) shell for every
// transactional email. `bodyHtml` must already be escaped. Arabic renders
// right-to-left.
export function renderLayout({
  title,
  bodyHtml,
  cta,
  locale = "en",
}: {
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  locale?: Locale;
}): string {
  const t = translator(locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const brand = currentBrand();
  const [plain, accent] = splitWordmark(brand.name);
  const logo = brand.logoUrl
    ? `
                <img src="${escapeHtml(brand.logoUrl)}" alt="" width="48" height="48" style="display: block; margin: 0 auto 10px; width: 48px; height: 48px; border-radius: 12px; object-fit: cover;" />`
    : "";
  const button = cta
    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(cta.url)}" style="display: inline-block; background-color: #35604b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 10px;">
                        ${escapeHtml(cta.label)}
                      </a>
                    </td>
                  </tr>
                </table>`
    : "";
  const footer = cta
    ? `
            <tr>
              <td style="padding: 20px 32px; background-color: #f4f7f5; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ${escapeHtml(t("layout.linkHelp"))} <br />
                  <a href="${escapeHtml(cta.url)}" style="color: #477a60;">${escapeHtml(cta.url)}</a>
                </p>
              </td>
            </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body dir="${dir}" style="margin: 0; padding: 0; background-color: #f4f7f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, sans-serif;">
    <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f5; padding: 32px 16px; direction: ${dir};">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e6ede8;">
            <tr>
              <td style="background: linear-gradient(135deg, #2b4d3d, #1f342b); padding: 32px; text-align: center;">
${logo}
                <p style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">
                  ${escapeHtml(plain)}<span style="color: #9dbeab;">${escapeHtml(accent)}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">${bodyHtml}${button}
              </td>
            </tr>${footer}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// "Robe kabyle — M" for an option, the product name otherwise.
export const itemLabel = (i: { productName: string; variantName?: string | null }) =>
  i.variantName ? `${i.productName} — ${i.variantName}` : i.productName;

// Small building blocks for email bodies (all values escaped here).
export const email = {
  heading: (text: string) =>
    `<p style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #1f342b;">${escapeHtml(text)}</p>`,
  paragraph: (text: string) =>
    `<p style="margin: 0 0 16px; font-size: 14px; color: #6b7280; line-height: 1.6;">${escapeHtml(text)}</p>`,
  muted: (text: string) =>
    `<p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">${escapeHtml(text)}</p>`,
  // Item rows + optional totals rows (amounts on the trailing side).
  lines: (
    items: { productName: string; variantName?: string | null; price: number; quantity: number }[],
    totals: [label: string, amount: number, tone?: "discount" | "strong"][],
    locale: Locale = "en",
  ) => {
    const end = locale === "ar" ? "left" : "right";
    const rows = items
      .map(
        (i) => `
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e6ede8; color: #374151; font-size: 14px;">${escapeHtml(itemLabel(i))} × ${i.quantity}</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e6ede8; color: #1f342b; font-size: 14px; text-align: ${end}; font-weight: 600;">${formatDzd(Number(i.price) * i.quantity)}</td>
                    </tr>`,
      )
      .join("");
    const totalRows = totals
      .map(([label, amount, tone]) => {
        const color = tone === "discount" ? "#16a34a" : tone === "strong" ? "#1f342b" : "#6b7280";
        const weight = tone === "strong" ? "font-weight: 700; font-size: 15px;" : "font-size: 13px;";
        const value = tone === "discount" ? `-${formatDzd(amount)}` : formatDzd(amount);
        return `
                    <tr>
                      <td style="padding: 8px 0 0; ${weight} color: ${color};">${escapeHtml(label)}</td>
                      <td style="padding: 8px 0 0; ${weight} color: ${color}; text-align: ${end};">${value}</td>
                    </tr>`;
      })
      .join("");
    return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 16px;">${rows}${totalRows}
                </table>`;
  },
};
