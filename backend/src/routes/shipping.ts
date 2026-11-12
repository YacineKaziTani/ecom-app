import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { ShippingZone } from "../entities/ShippingZone";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { audit } from "../services/audit";
import { communesOf } from "../services/communes";

const router = Router();
const repo = () => AppDataSource.getRepository(ShippingZone);

const priceSchema = z.number().min(0).max(100_000);

// Public: every wilaya with its delivery prices (inactive ones included, so
// the checkout can say "not delivered yet" instead of hiding the wilaya).
router.get("/zones", async (_req, res) => {
  const zones = await repo().find({ order: { code: "ASC" } });
  res.json(
    zones.map((z) => ({
      code: z.code,
      name: z.name,
      nameAr: z.nameAr,
      homePrice: Number(z.homePrice),
      deskPrice: z.deskPrice == null ? null : Number(z.deskPrice),
      isActive: z.isActive,
    })),
  );
});

// Public: the wilaya's communes, for the checkout and address dropdowns.
// Static data, so browsers and the CDN may keep it for a day.
router.get("/zones/:code/communes", (req, res) => {
  const code = Number(req.params.code);
  if (!Number.isInteger(code) || code < 1 || code > 99) {
    return res.status(400).json({ message: "Invalid wilaya code" });
  }
  res.set("Cache-Control", "public, max-age=86400");
  res.json(communesOf(code));
});

const zoneUpdateSchema = z.object({
  homePrice: priceSchema.optional(),
  deskPrice: priceSchema.nullable().optional(), // null = no stop-desk option
  isActive: z.boolean().optional(),
});

// Super admin: apply the same prices to every wilaya at once.
router.patch("/zones", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = zoneUpdateSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0)
    return res.status(400).json({ message: "Invalid input" });
  await repo().createQueryBuilder().update().set(parsed.data).execute();
  void audit(req, "shipping.update_all", "shipping_zone", null, parsed.data);
  res.json({ message: "All wilayas updated" });
});

router.patch("/zones/:code", requireAuth, requireSuperAdmin, async (req, res) => {
  const code = Number(req.params.code);
  const parsed = zoneUpdateSchema.safeParse(req.body);
  if (!Number.isInteger(code) || !parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const zone = await repo().findOne({ where: { code } });
  if (!zone) return res.status(404).json({ message: "Wilaya not found" });
  Object.assign(zone, parsed.data);
  await repo().save(zone);
  void audit(req, "shipping.update", "shipping_zone", String(code), parsed.data);
  res.json(zone);
});

export default router;
