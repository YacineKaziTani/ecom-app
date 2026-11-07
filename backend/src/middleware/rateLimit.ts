import rateLimit from "express-rate-limit";

const MINUTE = 60 * 1000;
const isTest = process.env.NODE_ENV === "test";

function limiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { message },
  });
}

export const apiLimiter = limiter(
  15 * MINUTE,
  300,
  "Too many requests — please slow down and try again shortly.",
);

export const loginLimiter = limiter(
  15 * MINUTE,
  50,
  "Too many login attempts — please wait a few minutes and try again.",
);

export const registerLimiter = limiter(
  60 * MINUTE,
  50,
  "Too many accounts created from this network — please try again later.",
);

export const refreshLimiter = limiter(
  15 * MINUTE,
  60,
  "Too many refresh attempts — please try again shortly.",
);

export const forgotPasswordLimiter = limiter(
  60 * MINUTE,
  15,
  "Too many password reset requests — please try again later.",
);

export const resetPasswordLimiter = limiter(
  15 * MINUTE,
  15,
  "Too many attempts — please try again shortly.",
);
