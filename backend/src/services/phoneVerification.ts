import crypto from "crypto";
import { currentBrand } from "./storeSettings";
import { EntityManager, IsNull, MoreThan } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { PhoneVerification } from "../entities/PhoneVerification";
import { HttpError } from "../utils/httpError";
import { sendSms } from "./sms";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MS = 15 * 60 * 1000;

const hash = (phone: string, code: string) =>
  crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");

const repo = () => AppDataSource.getRepository(PhoneVerification);

// Texts a 6-digit code. At most 3 codes per number per 15 minutes, so the
// endpoint can't be used to spam someone (or run up the SMS bill).
export async function requestPhoneCode(phone: string): Promise<void> {
  const recent = await repo().count({
    where: { phone, createdAt: MoreThan(new Date(Date.now() - WINDOW_MS)) },
  });
  if (recent >= MAX_CODES_PER_WINDOW) {
    throw new HttpError(429, "Too many codes sent to this number — try again in a few minutes");
  }
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await repo().save(
    repo().create({ phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) }),
  );
  await sendSms(phone, `${currentBrand().name}: your code is ${code}. It expires in 10 minutes.`);
}

// Checks a code against the latest live one for this number. Wrong guesses are
// counted (and saved, even if the checkout then fails) — 5 strikes and the code
// is dead. Returns the verification id, or null. Doesn't consume the code.
export async function verifyPhoneCode(phone: string, code: string): Promise<string | null> {
  return AppDataSource.transaction(async (manager) => {
    const latest = await manager.getRepository(PhoneVerification).findOne({
      where: { phone, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: "DESC" },
      lock: { mode: "pessimistic_write" },
    });
    if (!latest || latest.attempts >= MAX_ATTEMPTS) return null;
    const expected = Buffer.from(latest.codeHash);
    const given = Buffer.from(hash(phone, code));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      await manager.getRepository(PhoneVerification).increment({ id: latest.id }, "attempts", 1);
      return null;
    }
    return latest.id;
  });
}

// Marks the code used — inside the checkout transaction, so a failed checkout
// leaves it usable for the retry. Only an unused code can be consumed, so two
// concurrent checkouts can't both spend the same one.
export async function consumePhoneCode(manager: EntityManager, id: string): Promise<void> {
  const result = await manager
    .getRepository(PhoneVerification)
    .update({ id, usedAt: IsNull() }, { usedAt: new Date() });
  if (!result.affected) {
    throw new HttpError(400, "That code has already been used — ask for a new one", {
      code: "PHONE_CODE_INVALID",
    });
  }
}
