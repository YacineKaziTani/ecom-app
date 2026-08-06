import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuidSchema = z.string().uuid();

export function validateUuidParam(paramName: string = "id") {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    if (!uuidSchema.safeParse(value).success) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    next();
  };
}
