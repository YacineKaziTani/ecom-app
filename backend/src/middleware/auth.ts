import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { Shop } from "../entities/Shop";

export type UserRole = "super_admin" | "admin" | "customer";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as AuthPayload;
  } catch {
    // ignore invalid/expired token — proceed as a guest
  }
  next();
}

// super_admin OR admin (shop owner)
export function requireAnyAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// super_admin only
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
}

export async function attachShop(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role === "super_admin") return next();

  if (req.user?.role === "admin") {
    const shop = await AppDataSource.getRepository(Shop).findOne({
      where: { ownerId: req.user.id },
    });
    if (!shop)
      return res.status(404).json({
        message: "No shop found for this admin. Create a shop first.",
      });
    req.shopId = shop.id;
    return next();
  }

  next();
}
