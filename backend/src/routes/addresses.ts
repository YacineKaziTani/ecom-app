import { Router } from "express";
import { z } from "zod";
import { EntityManager, Not } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Address } from "../entities/Address";
import { User } from "../entities/User";
import { requestLocale } from "../utils/locale";
import type { Locale } from "../emails/i18n";
import { requireAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { addressSchema, algerianPhoneSchema } from "../utils/validators";
import { HttpError } from "../utils/httpError";

// The signed-in customer's address book. Checkout fills its delivery form
// from one of these; the default one is pre-selected.

const router = Router();
const repo = () => AppDataSource.getRepository(Address);
const MAX_ADDRESSES = 10;

router.use(requireAuth);

const addressBody = z.object({
  label: z.string().trim().min(1).max(40),
  phone: algerianPhoneSchema,
  wilayaCode: z.number().int().min(1).max(99),
  commune: z.string().trim().min(1).max(100),
  address: addressSchema,
  isDefault: z.boolean().optional(),
});

const list = (userId: string) =>
  repo().find({ where: { userId }, order: { isDefault: "DESC", createdAt: "ASC" } });

async function clearDefault(manager: EntityManager, userId: string, except: string) {
  await manager.getRepository(Address).update({ userId, id: Not(except), isDefault: true }, { isDefault: false });
}

async function findOwn(manager: EntityManager, userId: string, id: string) {
  const address = await manager.getRepository(Address).findOne({
    where: { id, userId },
    lock: { mode: "pessimistic_write" },
  });
  if (!address) throw new HttpError(404, "Address not found");
  return address;
}

const HOME_LABEL: Record<Locale, string> = { en: "Home", fr: "Domicile", ar: "المنزل" };

// Accounts from before the address book kept one address on the profile:
// the first visit moves it into the book as the default (moved, not copied,
// so deleting it later doesn't bring it back).
async function seedFromProfile(userId: string, locale: Locale) {
  return AppDataSource.transaction(async (manager) => {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: "pessimistic_write" }, // two first visits at once seed once
    });
    if (!user?.address || !user.wilayaCode || !user.commune || !user.phone) return null;
    if ((await manager.getRepository(Address).count({ where: { userId } })) > 0) return null;
    const phone = algerianPhoneSchema.safeParse(user.phone);
    if (!phone.success) return null;
    const addresses = manager.getRepository(Address);
    const seeded = await addresses.save(
      addresses.create({
        userId,
        label: HOME_LABEL[locale],
        phone: phone.data,
        wilayaCode: user.wilayaCode,
        commune: user.commune,
        address: user.address,
        isDefault: true,
      }),
    );
    await manager.query(
      `UPDATE users SET address = NULL, "wilayaCode" = NULL, commune = NULL WHERE id = $1`,
      [userId],
    );
    return seeded;
  });
}

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  let addresses = await list(userId);
  if (addresses.length === 0) {
    const seeded = await seedFromProfile(userId, requestLocale(req));
    if (seeded) addresses = [seeded];
  }
  res.json(addresses);
});

router.post("/", async (req, res) => {
  const parsed = addressBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const userId = req.user!.id;
  const created = await AppDataSource.transaction(async (manager) => {
    const addresses = manager.getRepository(Address);
    const count = await addresses.count({ where: { userId } });
    if (count >= MAX_ADDRESSES)
      throw new HttpError(400, `You can save up to ${MAX_ADDRESSES} addresses — delete one first`);
    // The first address is the default whatever was asked.
    const isDefault = count === 0 || parsed.data.isDefault === true;
    const saved = await addresses.save(addresses.create({ ...parsed.data, userId, isDefault }));
    if (isDefault) await clearDefault(manager, userId, saved.id);
    return saved;
  });
  res.status(201).json(created);
});

router.put("/:id", validateUuidParam(), async (req, res) => {
  const parsed = addressBody.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const userId = req.user!.id;
  const updated = await AppDataSource.transaction(async (manager) => {
    const address = await findOwn(manager, userId, req.params.id);
    // Only "make default" is meaningful; unsetting happens by choosing another.
    const { isDefault, ...fields } = parsed.data;
    Object.assign(address, fields);
    if (isDefault) address.isDefault = true;
    await manager.getRepository(Address).save(address);
    if (isDefault) await clearDefault(manager, userId, address.id);
    return address;
  });
  res.json(updated);
});

router.delete("/:id", validateUuidParam(), async (req, res) => {
  const userId = req.user!.id;
  await AppDataSource.transaction(async (manager) => {
    const address = await findOwn(manager, userId, req.params.id);
    await manager.getRepository(Address).delete(address.id);
    if (address.isDefault) {
      // Promote the oldest remaining address so there's still a default.
      const next = await manager.getRepository(Address).findOne({ where: { userId }, order: { createdAt: "ASC" } });
      if (next) await manager.getRepository(Address).update(next.id, { isDefault: true });
    }
  });
  res.status(204).send();
});

export default router;
