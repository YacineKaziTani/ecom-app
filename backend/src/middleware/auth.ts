import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { Shop } from "../entities/Shop";
import type { UserRole } from "../entities/User";

export interface AuthPayload {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      shopId?: string;
    }
  }
}

// The middlewares below are generic over the route params (`P`) so they don't
// erase the param types Express infers from the route path (e.g. "/:id").

function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
}

export function requireAuth<P>(
  req: Request<P>,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// For endpoints that work for guests AND signed-in users (checkout, payment).
// No cookie → guest. A cookie that fails verification → 401, so the client
// refreshes the session and retries, instead of a signed-in customer silently
// being treated as a guest because their 15-minute access token lapsed.
export function optionalAuth<P>(
  req: Request<P>,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAnyAdmin<P>(
  req: Request<P>,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function requireSuperAdmin<P>(
  req: Request<P>,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
}

// For shop admins, resolves their shop and sets req.shopId. super_admin and
// customers pass through untouched.
export async function attachShop<P>(
  req: Request<P>,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin") return next();

  const shop = await AppDataSource.getRepository(Shop).findOne({
    where: { ownerId: req.user.id },
  });
  if (!shop)
    return res.status(404).json({
      message: "No shop found for this admin. Create a shop first.",
    });
  req.shopId = shop.id;
  next();
}
