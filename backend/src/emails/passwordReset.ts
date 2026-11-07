import { email, renderLayout } from "./layout";
import type { RenderedEmail } from "./orderEmails";

export interface PasswordResetEmailData {
  name: string;
  resetLink: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): RenderedEmail {
  const { name, resetLink, expiresInMinutes } = data;

  const html = renderLayout({
    title: "Reset your password",
    bodyHtml:
      email.heading(`Hi ${name},`) +
      email.paragraph(
        `We received a request to reset your password. Click the button below to choose a new one. This link expires in ${expiresInMinutes} minutes.`,
      ) +
      email.muted(
        "If you didn't request this, you can safely ignore this email — your password won't change unless you click the link and set a new one.",
      ),
    cta: { label: "Reset your password", url: resetLink },
  });

  const text = [
    `Hi ${name},`,
    ``,
    `We received a request to reset your password. This link expires in ${expiresInMinutes} minutes:`,
    resetLink,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
  ].join("\n");

  return { subject: "Reset your password", html, text };
}
