import { logger } from "../config/logger";

// Pluggable SMS sending, chosen with SMS_PROVIDER:
//   (unset)  SMS disabled — the checkout code feature stays off
//   twilio   Twilio REST API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
//            TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID)
//   log      development only: writes the message to the server log
//   memory   tests only: keeps messages in `sentSms`
// Adding a local provider means adding one function here.

type Driver = (toE164: string, body: string) => Promise<void>;

export const sentSms: { to: string; body: string }[] = [];

const twilio: Driver = async (to, body) => {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const params = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    params.set("From", process.env.TWILIO_FROM!);
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`Twilio rejected the SMS (${res.status}): ${await res.text().catch(() => "")}`);
  }
};

function driver(): Driver | null {
  switch (process.env.SMS_PROVIDER) {
    case "twilio":
      return twilio;
    case "log":
      return async (to, body) => logger.info({ to, body }, "SMS (log driver — not sent)");
    case "memory":
      return async (to, body) => {
        sentSms.push({ to, body });
      };
    default:
      return null;
  }
}

export function smsEnabled(): boolean {
  return driver() !== null;
}

// "0550123456" → "+213550123456"
export function toE164(phone: string): string {
  return `+213${phone.replace(/^0/, "")}`;
}

export async function sendSms(phone: string, body: string): Promise<void> {
  const send = driver();
  if (!send) throw new Error("SMS is not configured");
  await send(toE164(phone), body);
}

// Pay-on-delivery orders at or above this total need an SMS code at checkout.
// null = feature off (no SMS provider, or no threshold set).
export function codOtpMinTotal(): number | null {
  const raw = process.env.COD_OTP_MIN_TOTAL;
  if (!smsEnabled() || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
