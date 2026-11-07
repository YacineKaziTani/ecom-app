import { Request } from "express";
import { AppDataSource } from "../config/data-source";
import { logger } from "../config/logger";
import { AuditLog } from "../entities/AuditLog";
import { User } from "../entities/User";
import { track } from "../utils/background";

// Records an admin action. Never throws — an audit write failing must not
// undo or block the action itself (it's logged instead).
export function audit(
  req: Request<any>,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  return track(writeAudit(req, action, entityType, entityId, details));
}

async function writeAudit(
  req: Request<any>,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const actorId = req.user?.id ?? null;
    const actor = actorId
      ? await AppDataSource.getRepository(User).findOne({ where: { id: actorId }, select: { email: true } })
      : null;
    const repo = AppDataSource.getRepository(AuditLog);
    await repo.save(
      repo.create({
        actorId,
        actorEmail: actor?.email ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ?? null,
        ip: req.ip ?? null,
      }),
    );
  } catch (err) {
    logger.error({ err, action, entityType, entityId }, "Failed to write audit log");
  }
}
