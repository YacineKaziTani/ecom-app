import { Resend } from "resend";
import { logger } from "./logger";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// MAIL_FROM is the documented name; EMAIL_FROM is accepted too.
export const MAIL_FROM =
  process.env.MAIL_FROM ||
  process.env.EMAIL_FROM ||
  "Artisan Shop <onboarding@resend.dev>";

export function verifyMailer() {
  if (!resend) {
    logger.warn(
      "RESEND_API_KEY not configured — order confirmation and password reset emails will be skipped.",
    );
    return;
  }
  logger.info("Resend configured — transactional emails are enabled.");
}
