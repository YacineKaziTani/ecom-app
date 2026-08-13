import { resend, MAIL_FROM } from "../config/mailer";
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
  if (!resend) {
    console.warn(
      `Resend not configured — skipping order confirmation email to ${to}`,
    );
    return;
  }

  const { subject, html, text } = renderOrderConfirmationEmail(data);

  try {
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    if (error)
      console.error(
        `Resend rejected order confirmation email to ${to}:`,
        error,
      );
  } catch (err) {
    console.error(`Failed to send order confirmation email to ${to}:`, err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  data: PasswordResetEmailData,
): Promise<boolean> {
  if (!resend) {
    console.warn(
      `Resend not configured — skipping password reset email to ${to}`,
    );
    return false;
  }

  const { subject, html, text } = renderPasswordResetEmail(data);

  try {
    const { error } = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error(`Resend rejected password reset email to ${to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send password reset email to ${to}:`, err);
    return false;
  }
}
