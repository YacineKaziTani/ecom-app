import { email, renderLayout } from "./layout";
import type { RenderedEmail } from "./orderEmails";

function simple(
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
    }),
    text: [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n"),
  };
}

export function sellerApplicationForAdminEmail(
  applicantName: string,
  shopName: string,
  reviewLink: string,
): RenderedEmail {
  return simple(
    `New seller application — ${shopName}`,
    "New seller application",
    [`${applicantName} wants to open "${shopName}" on ArtisanShop.`],
    { label: "Review applications", url: reviewLink },
  );
}

export function sellerApplicationDecisionEmail(
  approved: boolean,
  name: string,
  shopName: string,
  link: string,
  note?: string | null,
): RenderedEmail {
  if (approved) {
    return simple(
      `Your shop "${shopName}" is approved`,
      `Welcome aboard, ${name}!`,
      [
        `Your shop "${shopName}" has been created. Sign in again to open your dashboard, add products and start selling.`,
        ...(note ? [note] : []),
      ],
      { label: "Open my dashboard", url: link },
    );
  }
  return simple(
    `About your shop application`,
    `Hi ${name},`,
    [
      `Thanks for applying to open "${shopName}". We can't approve it right now.`,
      ...(note ? [`Reason: ${note}`] : []),
      "You're welcome to apply again later.",
    ],
  );
}

export function verifyEmailEmail(name: string, link: string): RenderedEmail {
  return simple(
    "Confirm your email address",
    `Hi ${name},`,
    [
      "Please confirm your email address so we can keep your account secure and send you order updates.",
      "This link expires in 24 hours.",
    ],
    { label: "Confirm my email", url: link },
  );
}
