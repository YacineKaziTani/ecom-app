import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { BlockedPhone } from "../entities/BlockedPhone";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { algerianPhoneSchema } from "../utils/validators";
import { paginated, parsePagination } from "../utils/pagination";
import { audit } from "../services/audit";

// Super admin: numbers that can't use pay on delivery.
const router = Router();
const repo = () => AppDataSource.getRepository(BlockedPhone);

router.use(requireAuth, requireSuperAdmin);

router.get("/", async (req, res) => {
  const pageParams = parsePagination(req.query);
  const [items, total] = await repo().findAndCount({
    order: { createdAt: "DESC" },
    skip: pageParams.skip,
    take: pageParams.limit,
  });
  res.json(paginated(items, total, pageParams));
});

router.post("/", async (req, res) => {
  const parsed = z
    .object({ phone: algerianPhoneSchema, reason: z.string().trim().max(200).optional() })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const entry = await repo().save(
    repo().create({ ...parsed.data, reason: parsed.data.reason || null, createdById: req.user!.id }),
  );
  void audit(req, "phone.block", "phone", entry.phone, { reason: entry.reason });
  res.status(201).json(entry);
});

router.delete("/:phone", async (req, res) => {
  const phone = algerianPhoneSchema.safeParse(req.params.phone);
  if (!phone.success) return res.status(400).json({ message: "Invalid phone number" });
  await repo().delete({ phone: phone.data });
  void audit(req, "phone.unblock", "phone", phone.data);
  res.status(204).send();
});

export default router;
