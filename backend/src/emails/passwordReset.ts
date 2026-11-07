import { escapeHtml } from "../utils/escapeHtml";

export interface PasswordResetEmailData {
  name: string;
  resetLink: string;
  expiresInMinutes: number;
}


export function renderPasswordResetEmail(data: PasswordResetEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, resetLink, expiresInMinutes } = data;
  const safeLink = escapeHtml(resetLink);

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f7f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f5; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e6ede8;">

            <tr>
              <td style="background: linear-gradient(135deg, #2b4d3d, #1f342b); padding: 32px; text-align: center;">
                <p style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">
                  Artisan<span style="color: #9dbeab;">Shop</span>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #1f342b;">Hi ${escapeHtml(name)},</p>
                <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; line-height: 1.6;">
                  We received a request to reset your password. Click the button below to choose a new one.
                  This link expires in ${expiresInMinutes} minutes.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="${safeLink}" style="display: inline-block; background-color: #35604b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 10px;">
                        Reset your password
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                  If you didn't request this, you can safely ignore this email — your password won't change unless you click the link above and set a new one.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 20px 32px; background-color: #f4f7f5; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  If the button doesn't work, copy this link: <br />
                  <a href="${safeLink}" style="color: #477a60;">${safeLink}</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${name},`,
    ``,
    `We received a request to reset your password. This link expires in ${expiresInMinutes} minutes:`,
    resetLink,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
  ].join("\n");

  return { subject: "Reset your password", html, text };
}
