import { resend, MAIL_FROM } from "../config/mailer";
import { logger } from "../config/logger";
import {
  renderOrderConfirmationEmail,
  OrderConfirmationEmailData,
} from "../emails/orderConfirmation";
import {
  renderPasswordResetEmail,
  PasswordResetEmailData,
} from "../emails/passwordReset";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Never throws: a failed or skipped email must not break the request that
// triggered it. Resolves to whether the email was accepted for delivery.
// Recipient addresses are deliberately kept out of the logs.
async function send(
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

export function sendOrderConfirmationEmail(
  to: string,
  data: OrderConfirmationEmailData,
) {
  return send("order-confirmation", to, renderOrderConfirmationEmail(data));
}

export function sendPasswordResetEmail(to: string, data: PasswordResetEmailData) {
  return send("password-reset", to, renderPasswordResetEmail(data));
}
