import { email, renderLayout } from "./layout";
import { Locale, translator } from "./i18n";
import type { RenderedEmail } from "./orderEmails";

export interface PasswordResetEmailData {
  name: string;
  resetLink: string;
  expiresInMinutes: number;
  locale?: Locale;
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): RenderedEmail {
  const { name, resetLink, expiresInMinutes, locale = "en" } = data;
  const t = translator(locale);
  const body = t("reset.body", { minutes: expiresInMinutes });

  const html = renderLayout({
    title: t("reset.subject"),
    bodyHtml:
      email.heading(t("account.hi", { name })) +
      email.paragraph(body) +
      email.muted(t("reset.ignore")),
    cta: { label: t("reset.subject"), url: resetLink },
    locale,
  });

  const text = [t("account.hi", { name }), "", body, resetLink, "", t("reset.ignore")].join("\n");

  return { subject: t("reset.subject"), html, text };
}
