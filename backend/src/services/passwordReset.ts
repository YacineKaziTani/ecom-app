import crypto from "crypto";
import { AppDataSource } from "../config/data-source";
import { PasswordResetToken } from "../entities/PasswordResetToken";

const RESET_TOKEN_TTL_MS = 90 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const repo = AppDataSource.getRepository(PasswordResetToken);
  await repo.delete({ userId });

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await repo.save(repo.create({ userId, tokenHash, expiresAt }));
  return raw;
}

export async function findValidPasswordResetToken(
  rawToken: string,
): Promise<PasswordResetToken | null> {
  const repo = AppDataSource.getRepository(PasswordResetToken);
  const record = await repo.findOne({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) {
    await repo.delete(record.id);
    return null;
  }
  return record;
}

export async function deletePasswordResetToken(id: string): Promise<void> {
  await AppDataSource.getRepository(PasswordResetToken).delete({ id });
}
