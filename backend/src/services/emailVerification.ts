import crypto from "crypto";
import { AppDataSource } from "../config/data-source";
import { EmailVerificationToken } from "../entities/EmailVerificationToken";
import { User } from "../entities/User";
import { verifyEmailEmail } from "../emails/accountEmails";
import * as mailer from "./email";

const TTL_MS = 24 * 60 * 60 * 1000;
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// Replaces any earlier link, then emails a fresh one.
export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "firstName">) {
  const repo = AppDataSource.getRepository(EmailVerificationToken);
  await repo.delete({ userId: user.id });
  const raw = crypto.randomBytes(32).toString("hex");
  await repo.save(
    repo.create({ userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL_MS) }),
  );
  const link = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${raw}`;
  return mailer.sendEmail("verify-email", user.email, verifyEmailEmail(user.firstName, link));
}

// Marks the account verified if the token is valid; single use.
export async function consumeVerificationToken(raw: string): Promise<boolean> {
  return AppDataSource.transaction(async (manager) => {
    const record = await manager
      .getRepository(EmailVerificationToken)
      .findOne({ where: { tokenHash: hash(raw) } });
    if (!record) return false;
    await manager.getRepository(EmailVerificationToken).delete({ userId: record.userId });
    if (record.expiresAt.getTime() < Date.now()) return false;
    await manager.getRepository(User).update(record.userId, { emailVerifiedAt: new Date() });
    return true;
  });
}
