import type { StoreSettings } from "../api/types";

// "0550123456" → "0550 12 34 56", "021123456" → "021 12 34 56".
export function formatPhone(phone: string): string {
  const mobile = phone.match(/^(0\d{3})(\d{2})(\d{2})(\d{2})$/);
  if (mobile) return mobile.slice(1).join(" ");
  const landline = phone.match(/^(0\d{2})(\d{2})(\d{2})(\d{2})$/);
  return landline ? landline.slice(1).join(" ") : phone;
}

// "213550123456" → "0550 12 34 56"; other countries → "+33612345678".
export function formatWhatsapp(digits: string): string {
  return digits.startsWith("213") && digits.length === 12 ? formatPhone(`0${digits.slice(3)}`) : `+${digits}`;
}

export const whatsappLink = (digits: string, text?: string) =>
  `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const telLink = (phone: string) => `tel:${phone}`;

// The details the legal pages and the law expect; listed for the super admin
// while they're still empty.
export const REQUIRED_DETAILS = ["legalName", "registerNumber", "taxId", "address", "email", "phone"] as const;
export type RequiredDetail = (typeof REQUIRED_DETAILS)[number];

export const missingDetails = (settings: StoreSettings | undefined): RequiredDetail[] =>
  settings ? REQUIRED_DETAILS.filter((key) => !settings[key]) : [];
