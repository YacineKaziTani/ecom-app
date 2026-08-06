import { Request, Response, NextFunction } from "express";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/<[^>]*>/g, "") // strip HTML tags
      .replace(/\u0000/g, "") // strip null bytes
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}
