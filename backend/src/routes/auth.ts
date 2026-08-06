import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { loginLimiter, registerLimiter, refreshLimiter, forgotPasswordLimiter, resetPasswordLimiter } from "../middleware/rateLimit";
import {
  issueSession,
  clearAuthCookies,
  findValidRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokenById,
  revokeAllRefreshTokensForUser,
} from "../utils/tokens";
import { createPasswordResetToken, findValidPasswordResetToken, deletePasswordResetToken } from "../services/passwordReset";
import { sendPasswordResetEmail } from "../services/email";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

// Names: letters, spaces, hyphens, apostrophes only — blocks stray markup/control
// characters while still allowing "Mary-Jane" / "O'Brien" style names.
const nameSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\s'-]+$/u, "Only letters, spaces, hyphens and apostrophes are allowed");

// At least 8 chars, one letter and one number — stricter than the previous
// bare min(6), without being so aggressive it locks out real passwords.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

router.post("/register", registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { email, password, firstName, lastName } = parsed.data;
  const repo = userRepo();

  const existing = await repo.findOne({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email already in use" });

  const hashed = await bcrypt.hash(password, 10);
  const user = repo.create({ email, password: hashed, firstName, lastName, role: "customer" });
  await repo.save(user);

  await issueSession(res, user);

  const { password: _pw, ...safeUser } = user;
  res.status(201).json({ user: safeUser });
});

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const { email, password } = parsed.data;
  const user = await userRepo().findOne({ where: { email } });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  await issueSession(res, user);

  const { password: _pw, ...safeUser } = user;
  res.json({ user: safeUser });
});

// Exchanges a valid refresh token for a new access token, rotating the refresh
// token itself in the process (old one deleted, new one issued) — so a stolen
// refresh token that gets used is immediately invalidated for its rightful owner
// too on their next refresh, which is a signal worth building alerting on later.
router.post("/refresh", refreshLimiter, async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (!rawRefreshToken) return res.status(401).json({ message: "Not authenticated" });

  const record = await findValidRefreshToken(rawRefreshToken);
  if (!record) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  const user = await userRepo().findOne({ where: { id: record.userId } });
  if (!user) {
    await deleteRefreshTokenById(record.id);
    clearAuthCookies(res);
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  // Rotate: invalidate the used refresh token, issue a fresh access+refresh pair.
  await deleteRefreshTokenById(record.id);
  await issueSession(res, user);

  res.json({ message: "Refreshed" });
});

router.post("/logout", async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (rawRefreshToken) {
    await deleteRefreshToken(rawRefreshToken).catch(() => {}); // best-effort — logout should succeed regardless
  }
  clearAuthCookies(res);
  res.json({ message: "Logged out" });
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

// Always responds with the same generic message whether or not the email
// belongs to an account — revealing that would let anyone enumerate which
// emails are registered just by trying this endpoint.
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const GENERIC_RESPONSE = { message: "If an account exists for that email, we've sent a password reset link." };

  const user = await userRepo().findOne({ where: { email: parsed.data.email } });
  if (!user) return res.json(GENERIC_RESPONSE); // don't reveal whether the account exists

  const rawToken = await createPasswordResetToken(user.id);
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const resetLink = `${clientUrl}/reset-password?token=${rawToken}`;

  sendPasswordResetEmail(user.email, { name: user.firstName, resetLink, expiresInMinutes: 60 });

  res.json(GENERIC_RESPONSE);
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const record = await findValidPasswordResetToken(parsed.data.token);
  if (!record) return res.status(400).json({ message: "This reset link is invalid or has expired" });

  const repo = userRepo();
  const user = await repo.findOne({ where: { id: record.userId } });
  if (!user) {
    await deletePasswordResetToken(record.id);
    return res.status(400).json({ message: "This reset link is invalid or has expired" });
  }

  user.password = await bcrypt.hash(parsed.data.newPassword, 10);
  await repo.save(user);

  // Single-use: the token can't be replayed once it's been used.
  await deletePasswordResetToken(record.id);
  // A password reset is a strong enough signal to end every other existing
  // session too — if the reset was prompted by a compromised account, this
  // kicks out whoever else might be logged in.
  await revokeAllRefreshTokensForUser(user.id);

  res.json({ message: "Password reset — you can now log in with your new password." });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await userRepo().findOne({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: "User not found" });
  const { password: _pw, ...safeUser } = user;
  res.json({ user: safeUser });
});

const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: z.string().trim().max(30).regex(/^[\d\s+()-]*$/, "Invalid phone number").optional(),
  address: z.string().trim().max(500).optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const repo = userRepo();
  const user = await repo.findOne({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: "User not found" });

  Object.assign(user, parsed.data);
  await repo.save(user);

  const { password: _pw, ...safeUser } = user;
  res.json({ user: safeUser });
});

// Super admin only: list all users (for the user-management dashboard screen).
router.get("/users", requireAuth, requireSuperAdmin, async (req, res) => {
  const searchRaw = typeof req.query.search === "string" ? req.query.search : undefined;
  const search = searchRaw?.slice(0, 100); // cap length defensively before it goes into a LIKE pattern
  const repo = userRepo();

  const qb = repo.createQueryBuilder("user").orderBy("user.createdAt", "DESC");
  if (search) {
    qb.where("user.email ILIKE :s OR user.firstName ILIKE :s OR user.lastName ILIKE :s", { s: `%${search}%` });
  }

  const users = await qb.getMany();
  res.json(users.map(({ password: _pw, ...safeUser }) => safeUser));
});

// Super admin only: promote/demote a user's role.
router.patch("/:id/role", validateUuidParam(), requireAuth, requireSuperAdmin, async (req, res) => {
  const schema = z.object({ role: z.enum(["super_admin", "admin", "customer"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid role" });

  // Guard against a super_admin locking themselves out by demoting their own account.
  if (req.params.id === req.user!.id && parsed.data.role !== "super_admin") {
    return res.status(400).json({ message: "You can't change your own super admin role" });
  }

  const repo = userRepo();
  const user = await repo.findOne({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: "User not found" });

  user.role = parsed.data.role;
  await repo.save(user);

  // Any refresh tokens issued under the old role get invalidated, so the change
  // takes effect on next refresh rather than only after the old access token expires.
  await revokeAllRefreshTokensForUser(user.id);

  const { password: _pw, ...safeUser } = user;
  res.json({ user: safeUser });
});

export default router;
