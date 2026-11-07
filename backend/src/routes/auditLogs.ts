import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { AuditLog } from "../entities/AuditLog";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { paginated, parsePagination } from "../utils/pagination";

const router = Router();

// Super admin: most recent first, optional ?action= (exact, e.g. "order.status_change").
router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const pageParams = parsePagination(req.query, 50);
  const action = typeof req.query.action === "string" ? req.query.action.slice(0, 100) : undefined;
  const [items, total] = await AppDataSource.getRepository(AuditLog).findAndCount({
    where: action ? { action } : {},
    order: { createdAt: "DESC" },
    skip: pageParams.skip,
    take: pageParams.limit,
  });
  res.json(paginated(items, total, pageParams));
});

export default router;
