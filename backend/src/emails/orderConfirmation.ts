import { escapeHtml } from "../utils/escapeHtml";
import { formatDzd } from "../utils/money";

export interface OrderConfirmationEmailData {
  name: string;
  orderId: string;
  orderLink: string;
  items: { productName: string; price: number; quantity: number }[];
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  total: number;
  shippingAddress: string;
}


export function renderOrderConfirmationEmail(
  data: OrderConfirmationEmailData,
): { subject: string; html: string; text: string } {
  const {
    name,
    orderId,
    orderLink,
    items,
    subtotal,
    discountAmount,
    couponCode,
    total,
    shippingAddress,
  } = data;
  const safeLink = escapeHtml(orderLink);

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e6ede8; color: #374151; font-size: 14px;">
            ${escapeHtml(item.productName)} × ${item.quantity}
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e6ede8; color: #1f342b; font-size: 14px; text-align: right; font-weight: 600;">
            ${formatDzd(Number(item.price) * item.quantity)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Order Confirmation</title>
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
                <p style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #1f342b;">Thanks, ${escapeHtml(name)}!</p>
                <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">Your order has been confirmed.</p>

                <p style="margin: 0 0 20px; font-size: 13px; color: #6b7280;">
                  Order ID:
                  <span style="font-family: 'SF Mono', Menlo, monospace; color: #374151; word-break: break-all;">${escapeHtml(orderId)}</span>
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                  ${itemRows}
                  ${
                    discountAmount && discountAmount > 0
                      ? `
                  <tr>
                    <td style="padding: 10px 0 0; font-size: 13px; color: #6b7280;">Subtotal</td>
                    <td style="padding: 10px 0 0; font-size: 13px; color: #6b7280; text-align: right;">${formatDzd(subtotal ?? total + discountAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0 0; font-size: 13px; color: #16a34a;">Discount${couponCode ? ` (${escapeHtml(couponCode)})` : ""}</td>
                    <td style="padding: 4px 0 0; font-size: 13px; color: #16a34a; text-align: right;">-${formatDzd(discountAmount)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding: 14px 0 0; font-size: 15px; font-weight: 700; color: #1f342b;">Total</td>
                    <td style="padding: 14px 0 0; font-size: 15px; font-weight: 700; color: #1f342b; text-align: right;">${formatDzd(total)}</td>
                  </tr>
                </table>

                <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280;">
                  Shipping to: ${escapeHtml(shippingAddress)}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                  <tr>
                    <td align="center">
                      <a href="${safeLink}" style="display: inline-block; background-color: #35604b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 10px;">
                        View your order
                      </a>
                    </td>
                  </tr>
                </table>
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
    `Thanks, ${name}!`,
    `Your order has been confirmed.`,
    ``,
    `Order ID: ${orderId}`,
    ``,
    ...items.map(
      (i) =>
        `${i.productName} x${i.quantity} — ${formatDzd(Number(i.price) * i.quantity)}`,
    ),
    ``,
    ...(discountAmount && discountAmount > 0
      ? [
          `Subtotal: ${formatDzd(subtotal ?? total + discountAmount)}`,
          `Discount${couponCode ? ` (${couponCode})` : ""}: -${formatDzd(discountAmount)}`,
        ]
      : []),
    `Total: ${formatDzd(total)}`,
    `Shipping to: ${shippingAddress}`,
    ``,
    `View your order: ${orderLink}`,
  ].join("\n");

  return { subject: `Order confirmed — #${orderId.slice(0, 8)}`, html, text };
}
