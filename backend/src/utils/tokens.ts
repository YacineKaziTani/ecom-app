import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../config/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { User } from "../entities/User";

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL_MS = parseTtlToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || "30d");

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // fallback: 30 days
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * unitMs;
}

export function signAccessToken(user: Pick<User, "id" | "role">) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Issues a brand-new refresh token for a user, persisting only its hash.
async function createRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const repo = AppDataSource.getRepository(RefreshToken);
  const record = repo.create({ userId, tokenHash, expiresAt });
  await repo.save(record);

  return raw;
}

// Looks up a refresh token by its hash. Returns the DB record (with userId) if
// it's valid and unexpired, or null otherwise.
export async function findValidRefreshToken(rawToken: string): Promise<RefreshToken | null> {
  const tokenHash = hashToken(rawToken);
  const repo = AppDataSource.getRepository(RefreshToken);
  const record = await repo.findOne({ where: { tokenHash } });
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) {
    await repo.delete(record.id);
    return null;
  }
  return record;
}

export async function deleteRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await AppDataSource.getRepository(RefreshToken).delete({ tokenHash });
}

export async function deleteRefreshTokenById(id: string): Promise<void> {
  await AppDataSource.getRepository(RefreshToken).delete({ id });
}

// Revokes every refresh token for a user — used when an admin changes someone's
// role, so any session issued under the old role can't keep coasting on a
// still-valid refresh token until it happens to expire.
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await AppDataSource.getRepository(RefreshToken).delete({ userId });
}

const isProd = process.env.NODE_ENV === "production";

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    // The cookie deliberately lives as long as the session; the JWT's own
    // 15-minute exp is what's enforced. That way an expired token still reaches
    // the server, which answers 401 so the client refreshes — even on
    // optionalAuth routes (checkout), where a missing cookie means "guest".
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth", // only sent on auth endpoints — narrows exposure of the refresh cookie
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("token");
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

// Issues a fresh access+refresh pair for a user and sets both cookies —
// shared by register, login, and the rotation step in /refresh.
export async function issueSession(res: Response, user: Pick<User, "id" | "role">) {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);
}
