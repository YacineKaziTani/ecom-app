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

export const nameSchema = z.string().trim().min(1).max(150);
export const shortTextSchema = z.string().trim().max(2000).optional();
export const addressSchema = z.string().trim().min(1).max(500);

// Clamps a query-string pagination value to a sane range, defaulting on anything malformed.
export function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}
