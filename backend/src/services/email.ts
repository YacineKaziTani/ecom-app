import { transporter, MAIL_FROM } from "../config/mailer";
import {
  renderOrderConfirmationEmail,
  OrderConfirmationEmailData,
} from "../emails/orderConfirmation";
import {
  renderPasswordResetEmail,
  PasswordResetEmailData,
} from "../emails/passwordReset";

export async function sendOrderConfirmationEmail(
  to: string,
  data: OrderConfirmationEmailData,
) {
  if (!process.env.SMTP_HOST) {
    console.warn(
      `SMTP not configured — skipping order confirmation email to ${to}`,
    );
    return;
  }

  const { subject, html, text } = renderOrderConfirmationEmail(data);

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text });
  } catch (err) {
    console.error(`Failed to send order confirmation email to ${to}:`, err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  data: PasswordResetEmailData,
): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.warn(
      `SMTP not configured — skipping password reset email to ${to}`,
    );
    return false;
  }

  const { subject, html, text } = renderPasswordResetEmail(data);

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text });
    return true;
  } catch (err) {
    console.error(`Failed to send password reset email to ${to}:`, err);
    return false;
  }
}
