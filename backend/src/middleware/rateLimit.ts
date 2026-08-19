import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";
const skip = () => isTest;

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message: "Too many requests — please slow down and try again shortly.",
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 100,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message:
      "Too many login attempts — please wait a few minutes and try again.",
  },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 100,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message:
      "Too many accounts created from this network — please try again later.",
  },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 100,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many refresh attempts — please try again shortly." },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 100,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message: "Too many password reset requests — please try again later.",
  },
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 100,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many attempts — please try again shortly." },
});
