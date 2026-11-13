import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { audit } from "../services/audit";
import { getStoreSettings, updateStoreSettings } from "../services/storeSettings";
import { httpsUrlSchema, imageUrlSchema } from "../utils/validators";
import { AppDataSource } from "../config/data-source";
import { Shop } from "../entities/Shop";

// The store's business details (Dashboard → Store info): public, because the
// Contact page, the WhatsApp button and the legal pages show them.
const router = Router();

// "" clears a field.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const digitsOf = (v: string) => v.replace(/[\s.()-]/g, "");

// A mobile or a landline, stored as "0XXXXXXXX(X)" like the order phones.
const contactPhone = z
  .string()
  .trim()
  .transform(digitsOf)
  .refine((v) => v === "" || /^(?:\+213|00213|0)[1-9]\d{7,8}$/.test(v), {
    message: "Enter an Algerian phone number, e.g. 0550 12 34 56 or 021 12 34 56",
  })
  .transform((v) => (v ? "0" + v.replace(/^(?:\+213|00213|0)/, "") : null))
  .nullable();

// An Algerian mobile (0550…) or any international number (+33…), stored as
// the digits a wa.me link needs: "213550123456". "+213 0550…" (with the
// trunk 0) is accepted too; other +213 numbers aren't mobiles.
const ALGERIAN_MOBILE = /^(?:(?:\+|00)2130?|0)([567]\d{8})$/;
const INTERNATIONAL = /^(?:\+|00)(?!213)[1-9]\d{7,14}$/;
const whatsappNumber = z
  .string()
  .trim()
  .transform(digitsOf)
  .refine((v) => v === "" || ALGERIAN_MOBILE.test(v) || INTERNATIONAL.test(v), {
    message: "Enter a mobile number, e.g. 0550 12 34 56 or +33 6 12 34 56 78",
  })
  .transform((v) => {
    if (!v) return null;
    const algerian = v.match(ALGERIAN_MOBILE);
    return algerian ? `213${algerian[1]}` : v.replace(/^(?:\+|00)/, "");
  })
  .nullable();

const link = httpsUrlSchema;

const days = (min: number, max: number) => z.number().int().min(min).max(max);

const settingsSchema = z
  .object({
    brandName: z.string().trim().min(1).max(60),
    logoUrl: imageUrlSchema,
    legalName: optionalText(120),
    registerNumber: optionalText(60),
    taxId: optionalText(40),
    address: optionalText(300),
    phone: contactPhone,
    whatsapp: whatsappNumber,
    email: z
      .string()
      .trim()
      .max(254)
      .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Enter a valid email address" })
      .transform((v) => v.toLowerCase() || null)
      .nullable(),
    openingHours: optionalText(120),
    facebookUrl: link,
    instagramUrl: link,
    tiktokUrl: link,
    deliveryDaysMin: days(1, 60),
    deliveryDaysMax: days(1, 60),
    exchangeDays: days(0, 60),
    // Free delivery from this products total; null: never.
    freeShippingThreshold: z.number().min(0).max(10_000_000).nullable(),
    // Advertising pixels (loaded only for visitors who accept them); "" removes one.
    facebookPixelId: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{8,20}$/.test(v), { message: "A Meta pixel ID is a number of 8 to 20 digits" })
      .transform((v) => v || null)
      .nullable(),
    tiktokPixelId: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z0-9]{10,30}$/.test(v), { message: "A TikTok pixel ID is 10 to 30 letters and digits" })
      .transform((v) => v || null)
      .nullable(),
    // The artisan shown on the home page; null: picked automatically.
    featuredShopId: z.string().uuid().nullable(),
  })
  .partial()
  .strict();

router.get("/", async (_req, res) => {
  res.json(await getStoreSettings());
});

router.put("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const current = await getStoreSettings();
  const min = parsed.data.deliveryDaysMin ?? current.deliveryDaysMin;
  const max = parsed.data.deliveryDaysMax ?? current.deliveryDaysMax;
  if (min > max)
    return res.status(400).json({ message: "The shortest delivery time can't be longer than the longest" });

  if (parsed.data.featuredShopId && !(await AppDataSource.getRepository(Shop).exist({ where: { id: parsed.data.featuredShopId } })))
    return res.status(400).json({ message: "That shop doesn't exist" });

  const saved = await updateStoreSettings(parsed.data, current);
  const changed = Object.keys(parsed.data).filter(
    (key) => current[key as keyof typeof current] !== saved[key as keyof typeof saved],
  );
  if (changed.length) void audit(req, "settings.update", "settings", null, { fields: changed });
  res.json(saved);
});

export default router;
