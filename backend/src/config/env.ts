// Startup configuration checks. Errors stop the server from booting (better a
// failed deploy than a running app with a guessable JWT secret or a payment
// webhook pointing at localhost); warnings are logged and boot continues.
export function checkEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === "production";
  const isHttps = (url?: string) => !!url && url.startsWith("https://");
  const isLocal = (url?: string) =>
    !url || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

  if (!env.JWT_SECRET) {
    errors.push("JWT_SECRET is required.");
  } else if (isProd && env.JWT_SECRET.length < 32) {
    errors.push(
      "JWT_SECRET must be at least 32 characters in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }

  if (!env.DATABASE_URL && !env.DB_HOST && isProd) {
    errors.push("Set DATABASE_URL (or the DB_* variables) in production.");
  }

  if (isProd) {
    if (isLocal(env.CLIENT_URL)) {
      errors.push(
        "CLIENT_URL must be the deployed frontend origin in production (used for CORS and email/payment links).",
      );
    }
    if (env.CHARGILY_API_KEY && (isLocal(env.API_PUBLIC_URL) || !isHttps(env.API_PUBLIC_URL))) {
      errors.push(
        "API_PUBLIC_URL must be the public https URL of this backend, or Chargily can't deliver payment webhooks.",
      );
    }
    if (!env.TOTP_ENCRYPTION_KEY) {
      warnings.push(
        "TOTP_ENCRYPTION_KEY is not set — 2FA secrets are encrypted with a key derived from JWT_SECRET, so rotating JWT_SECRET would reset everyone's 2FA. Set a long random value once and never change it.",
      );
    }
    if (!env.TRUST_PROXY) {
      warnings.push(
        "TRUST_PROXY is not set — assuming 1 proxy hop (Render). If requests also pass through the Vercel /api rewrite, set TRUST_PROXY=2 so rate limits see real client IPs.",
      );
    }
  } else if (isHttps(env.CLIENT_URL)) {
    warnings.push(
      "CLIENT_URL is https but NODE_ENV isn't 'production' — auth cookies won't be marked Secure. Set NODE_ENV=production on the server.",
    );
  }

  if (env.PLATFORM_COMMISSION_PERCENT !== undefined) {
    const pct = Number(env.PLATFORM_COMMISSION_PERCENT);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errors.push("PLATFORM_COMMISSION_PERCENT must be a number between 0 and 100.");
    }
  }

  const chargilyKey = env.CHARGILY_API_KEY;
  if (chargilyKey) {
    const live = env.CHARGILY_MODE === "live";
    if (live && chargilyKey.startsWith("test_"))
      warnings.push("CHARGILY_MODE=live but CHARGILY_API_KEY is a test key.");
    if (!live && chargilyKey.startsWith("live_"))
      warnings.push("CHARGILY_API_KEY is a live key but CHARGILY_MODE isn't 'live'.");
  } else {
    warnings.push("CHARGILY_API_KEY is not set — online payments will fail.");
  }
  // (A missing RESEND_API_KEY is reported by verifyMailer at startup.)
  if (!env.CLOUDINARY_CLOUD_NAME)
    warnings.push("Cloudinary is not configured — image uploads will fail.");

  return { errors, warnings };
}
