import { resend, MAIL_FROM } from "../config/mailer";
import { logger } from "../config/logger";
import type { RenderedEmail } from "../emails/orderEmails";
import {
  renderPasswordResetEmail,
  PasswordResetEmailData,
} from "../emails/passwordReset";

// Never throws: a failed or skipped email must not break the request that
// triggered it. Resolves to whether the email was accepted for delivery.
// Recipient addresses are deliberately kept out of the logs.
export async function sendEmail(
  template: string,
  to: string,
  email: RenderedEmail,
): Promise<boolean> {
  if (!resend) {
    logger.warn({ template }, "Resend not configured — email skipped");
    return false;
  }
  try {
    const { error } = await resend.emails.send({ from: MAIL_FROM, to, ...email });
    if (error) {
      logger.error({ template, error }, "Resend rejected email");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ template, err }, "Failed to send email");
    return false;
  }
}

export function sendPasswordResetEmail(to: string, data: PasswordResetEmailData) {
  return sendEmail("password-reset", to, renderPasswordResetEmail(data));
}
