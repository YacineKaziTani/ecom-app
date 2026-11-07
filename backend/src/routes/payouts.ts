import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Payout } from "../entities/Payout";
import { requireAuth, requireAnyAdmin, requireSuperAdmin, attachShop } from "../middleware/auth";
import { commissionPercent, shopBalances } from "../services/payouts";
import { paginated, parsePagination } from "../utils/pagination";
import { audit } from "../services/audit";

const router = Router();
const repo = () => AppDataSource.getRepository(Payout);

// Super admin: every shop's balance, to know who to pay.
router.get("/balances", requireAuth, requireSuperAdmin, async (_req, res) => {
  res.json({ commissionPercent: commissionPercent(), shops: await shopBalances() });
});

// Shop admin: their own balance.
router.get("/mine", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  if (!req.shopId) return res.status(400).json({ message: "Super admins don't have a shop" });
  const [balance] = await shopBalances(req.shopId);
  res.json({ commissionPercent: commissionPercent(), ...balance });
});

// Payout history: a shop admin sees theirs; a super admin all (or ?shopId=).
router.get("/", requireAuth, requireAnyAdmin, attachShop, async (req, res) => {
  const pageParams = parsePagination(req.query);
  const shopId =
    req.user!.role === "super_admin"
      ? typeof req.query.shopId === "string" && z.string().uuid().safeParse(req.query.shopId).success
        ? req.query.shopId
        : undefined
      : req.shopId;

  const [items, total] = await repo().findAndCount({
    where: shopId ? { shopId } : {},
    relations: ["shop"],
    order: { createdAt: "DESC" },
    skip: pageParams.skip,
    take: pageParams.limit,
  });
  res.json(paginated(items, total, pageParams));
});

const payoutSchema = z.object({
  shopId: z.string().uuid(),
  amount: z.number().positive().max(100_000_000),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

// Super admin records a transfer made to a shop. Can't exceed what the shop
// is owed, so a typo can't silently overpay.
router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = payoutSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const [balance] = await shopBalances(parsed.data.shopId);
  if (!balance) return res.status(404).json({ message: "Shop not found" });
  if (parsed.data.amount > balance.balance + 0.001) {
    return res.status(400).json({
      message: `This shop is owed ${balance.balance} DA — the payout can't be larger`,
    });
  }

  const payout = repo().create({ ...parsed.data, createdById: req.user!.id });
  await repo().save(payout);
  void audit(req, "payout.create", "shop", payout.shopId, {
    amount: payout.amount,
    reference: payout.reference,
  });
  res.status(201).json(payout);
});

export default router;
