import { z } from "zod";

// Optional image URL: if provided, must be a well-formed http(s) URL. An empty
// string means "remove the image" (the frontend's ImageUpload component sends
// "" when a user removes one) and becomes null, so updates actually clear it.
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((val) => val === "" || /^https?:\/\/.+/i.test(val), {
    message: "Must be a valid http(s) URL",
  })
  .optional()
  .transform((val) => (val === "" ? null : val));

// An optional https link (social pages, external banner links); "" clears it.
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), { message: "Must start with https://" })
  .transform((v) => v || null)
  .nullable();

export const nameSchema = z.string().trim().min(1).max(150);
export const shortTextSchema = z.string().trim().max(2000).optional();
export const addressSchema = z.string().trim().min(1).max(500);

// Algerian mobile number (05 / 06 / 07 …). Accepts +213 / 00213 prefixes,
// spaces, dots and dashes; normalised to "0XXXXXXXXX" so couriers can call it.
const PHONE_PREFIX = /^(?:\+213|00213|0)/;
export const algerianPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => /^(?:\+213|00213|0)[567]\d{8}$/.test(v), {
    message: "Enter a valid Algerian mobile number, e.g. 0550 12 34 56",
  })
  .transform((v) => "0" + v.replace(PHONE_PREFIX, ""));

// Clamps a query-string pagination value to a sane range, defaulting on anything malformed.
export function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}
