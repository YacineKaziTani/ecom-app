import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { audit } from "../services/audit";
import { getStoreSettings, updateStoreSettings } from "../services/storeSettings";

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
// the digits a wa.me link needs: "213550123456".
const whatsappNumber = z
  .string()
  .trim()
  .transform(digitsOf)
  .refine((v) => v === "" || /^(?:\+213|00213|0)[567]\d{8}$/.test(v) || /^(?:\+|00)[1-9]\d{7,14}$/.test(v), {
    message: "Enter a mobile number, e.g. 0550 12 34 56 or +33 6 12 34 56 78",
  })
  .transform((v) => {
    if (!v) return null;
    const algerian = v.match(/^(?:\+213|00213|0)([567]\d{8})$/);
    return algerian ? `213${algerian[1]}` : v.replace(/^(?:\+|00)/, "");
  })
  .nullable();

const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), { message: "Must start with https://" })
  .transform((v) => v || null)
  .nullable();

const days = (min: number, max: number) => z.number().int().min(min).max(max);

const settingsSchema = z
  .object({
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

  const saved = await updateStoreSettings(parsed.data);
  const changed = Object.keys(parsed.data).filter(
    (key) => current[key as keyof typeof current] !== saved[key as keyof typeof saved],
  );
  if (changed.length) void audit(req, "settings.update", "settings", null, { fields: changed });
  res.json(saved);
});

export default router;
