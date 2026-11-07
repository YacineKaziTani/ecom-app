import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { requireAuth, requireAnyAdmin } from "../middleware/auth";
import { HttpError } from "../utils/httpError";
import { open, seal } from "../utils/secretBox";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "../utils/totp";
import { audit } from "../services/audit";

const router = Router();
const users = () => AppDataSource.getRepository(User);

// Loads the 2FA fields that are normally never selected.
export function loadWithTotp(id: string) {
  return users()
    .createQueryBuilder("user")
    .addSelect(["user.totpSecret", "user.totpRecoveryCodes", "user.totpLastUsedStep"])
    .where("user.id = :id", { id })
    .getOne();
}

// Checks a 6-digit code or a recovery code. A used recovery code is burned and
// a used TOTP step can't be replayed. Returns whether it was accepted.
export async function checkSecondFactor(user: User, input: string): Promise<boolean> {
  const code = input.trim();
  if (/^\d{6}$/.test(code)) {
    const secret = user.totpSecret ? open(user.totpSecret) : null;
    if (!secret) return false;
    const step = verifyTotp(secret, code);
    if (step === null || (user.totpLastUsedStep != null && step <= user.totpLastUsedStep)) return false;
    await users().update(user.id, { totpLastUsedStep: step });
    return true;
  }
  const hashed = hashRecoveryCode(code);
  const remaining = user.totpRecoveryCodes ?? [];
  if (!remaining.includes(hashed)) return false;
  await users().update(user.id, { totpRecoveryCodes: remaining.filter((h) => h !== hashed) });
  return true;
}

router.use(requireAuth, requireAnyAdmin);

// Step 1: create a (not yet active) secret and show it as a QR code.
router.post("/setup", async (req, res) => {
  const user = await loadWithTotp(req.user!.id);
  if (!user) throw new HttpError(404, "User not found");
  if (user.totpEnabledAt) throw new HttpError(400, "Two-factor sign-in is already on");

  const secret = generateTotpSecret();
  await users().update(user.id, { totpSecret: seal(secret), totpLastUsedStep: null });
  const url = otpauthUrl(secret, user.email);
  res.json({ secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
});

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

// Step 2: prove the authenticator app works, then turn it on and hand out
// one-time recovery codes (shown only now).
router.post("/enable", async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter the 6-digit code" });
  const user = await loadWithTotp(req.user!.id);
  if (!user?.totpSecret) throw new HttpError(400, "Start the setup first");
  if (user.totpEnabledAt) throw new HttpError(400, "Two-factor sign-in is already on");

  const secret = open(user.totpSecret);
  const step = secret ? verifyTotp(secret, parsed.data.code) : null;
  if (step === null) throw new HttpError(400, "That code didn't match — check the time on your phone and try again");

  const recoveryCodes = generateRecoveryCodes();
  await users().update(user.id, {
    totpEnabledAt: new Date(),
    totpLastUsedStep: step,
    totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
  });
  await audit(req, "auth.2fa_enable", "user", user.id);
  res.json({ recoveryCodes });
});

router.post("/disable", async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a code" });
  const user = await loadWithTotp(req.user!.id);
  if (!user?.totpEnabledAt) throw new HttpError(400, "Two-factor sign-in is off");
  if (!(await checkSecondFactor(user, parsed.data.code))) throw new HttpError(400, "That code didn't match");

  await users().update(user.id, {
    totpEnabledAt: null,
    totpSecret: null,
    totpRecoveryCodes: null,
    totpLastUsedStep: null,
  });
  await audit(req, "auth.2fa_disable", "user", user.id);
  res.json({ message: "Two-factor sign-in turned off" });
});

export default router;
