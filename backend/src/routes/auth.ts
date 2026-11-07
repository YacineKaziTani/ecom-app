import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middleware/rateLimit";
import {
  issueSession,
  clearAuthCookies,
  findValidRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokenById,
  revokeAllRefreshTokensForUser,
} from "../utils/tokens";
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
  deletePasswordResetToken,
  RESET_TOKEN_TTL_MINUTES,
} from "../services/passwordReset";
import { sendPasswordResetEmail } from "../services/email";
import { paginated, parsePagination } from "../utils/pagination";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

// `password` is select:false, but a user we just created/hashed in memory (or
// explicitly selected for login) still carries it — strip it before responding.
function toPublicUser({ password: _pw, ...user }: User) {
  return user;
}

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[\p{L}\s'-]+$/u,
    "Only letters, spaces, hyphens and apostrophes are allowed",
  );

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
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const { email, password, firstName, lastName } = parsed.data;
  const repo = userRepo();

  const existing = await repo.findOne({ where: { email } });
  if (existing)
    return res.status(409).json({ message: "Email already in use" });

  const hashed = await bcrypt.hash(password, 10);
  const user = repo.create({
    email,
    password: hashed,
    firstName,
    lastName,
    role: "customer",
  });
  await repo.save(user);

  await issueSession(res, user);
  res.status(201).json({ user: toPublicUser(user) });
});

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const { email, password } = parsed.data;
  const user = await userRepo()
    .createQueryBuilder("user")
    .addSelect("user.password")
    .where("user.email = :email", { email })
    .getOne();
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  await issueSession(res, user);
  res.json({ user: toPublicUser(user) });
});

router.post("/refresh", refreshLimiter, async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (!rawRefreshToken) {
    clearAuthCookies(res); // drop any stale access-token cookie too
    return res.status(401).json({ message: "Not authenticated" });
  }

  const record = await findValidRefreshToken(rawRefreshToken);
  if (!record) {
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ message: "Session expired, please log in again" });
  }

  const user = await userRepo().findOne({ where: { id: record.userId } });
  if (!user) {
    await deleteRefreshTokenById(record.id);
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ message: "Session expired, please log in again" });
  }

  await deleteRefreshTokenById(record.id);
  await issueSession(res, user);

  res.json({ message: "Refreshed" });
});

router.post("/logout", async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (rawRefreshToken) {
    await deleteRefreshToken(rawRefreshToken).catch(() => {});
  }
  clearAuthCookies(res);
  res.json({ message: "Logged out" });
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });

  const GENERIC_RESPONSE = {
    message:
      "If an account exists for that email, we've sent a password reset link.",
  };

  const user = await userRepo().findOne({
    where: { email: parsed.data.email },
  });
  if (!user) return res.json(GENERIC_RESPONSE);

  const rawToken = await createPasswordResetToken(user.id);
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const resetLink = `${clientUrl}/reset-password?token=${rawToken}`;

  sendPasswordResetEmail(user.email, {
    name: user.firstName,
    resetLink,
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  });

  res.json(GENERIC_RESPONSE);
});

const resetPasswordSchema = z.object({
  token: z
    .string()
    .regex(
      /^[a-f0-9]{64}$/,
      "Reset link is malformed — please request a new one",
    ),
  newPassword: passwordSchema,
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const record = await findValidPasswordResetToken(parsed.data.token);
  if (!record)
    return res
      .status(400)
      .json({ message: "This reset link is invalid or has expired" });

  const repo = userRepo();
  const user = await repo.findOne({ where: { id: record.userId } });
  if (!user) {
    await deletePasswordResetToken(record.id);
    return res
      .status(400)
      .json({ message: "This reset link is invalid or has expired" });
  }

  user.password = await bcrypt.hash(parsed.data.newPassword, 10);
  await repo.save(user);

  await deletePasswordResetToken(record.id);
  await revokeAllRefreshTokensForUser(user.id);

  res.json({
    message: "Password reset — you can now log in with your new password.",
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await userRepo().findOne({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[\d\s+()-]*$/, "Invalid phone number")
    .optional(),
  address: z.string().trim().max(500).optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });

  const repo = userRepo();
  const user = await repo.findOne({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: "User not found" });

  Object.assign(user, parsed.data);
  await repo.save(user);
  res.json({ user });
});

// Super admin only: paginated user list (for the user-management dashboard screen).
router.get("/users", requireAuth, requireSuperAdmin, async (req, res) => {
  const pageParams = parsePagination(req.query);
  const searchRaw =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const search = searchRaw?.slice(0, 100); // cap length defensively before it goes into a LIKE pattern

  const qb = userRepo()
    .createQueryBuilder("user")
    .orderBy("user.createdAt", "DESC")
    .skip(pageParams.skip)
    .take(pageParams.limit);
  if (search) {
    qb.where(
      "user.email ILIKE :s OR user.firstName ILIKE :s OR user.lastName ILIKE :s",
      { s: `%${search}%` },
    );
  }

  const [items, total] = await qb.getManyAndCount();
  res.json(paginated(items, total, pageParams));
});

router.patch(
  "/:id/role",
  validateUuidParam(),
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const schema = z.object({
      role: z.enum(["super_admin", "admin", "customer"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid role" });

    if (req.params.id === req.user!.id && parsed.data.role !== "super_admin") {
      return res
        .status(400)
        .json({ message: "You can't change your own super admin role" });
    }

    const repo = userRepo();
    const user = await repo.findOne({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = parsed.data.role;
    await repo.save(user);

    await revokeAllRefreshTokensForUser(user.id);
    res.json({ user });
  },
);

export default router;
