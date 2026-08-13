import crypto from "crypto";

// Reference: https://dev.chargily.com/pay-v2/the-full-guide/create-a-checkout
// and https://dev.chargily.com/pay-v2/webhooks
const CHARGILY_MODE = process.env.CHARGILY_MODE === "live" ? "live" : "test";
const CHARGILY_BASE_URL = process.env.CHARGILY_BASE_URL;
CHARGILY_MODE === "live"
  ? "https://pay.chargily.net/api/v2"
  : "https://pay.chargily.net/test/api/v2";
const CHARGILY_API_KEY = process.env.CHARGILY_API_KEY;
const CHARGILY_LOCALE = process.env.CHARGILY_LOCALE || "ar"; // 'ar' | 'en' | 'fr'

export interface CreateCheckoutParams {
  amount: number; // whole DZD units — Chargily does not use minor-unit (cents) amounts
  orderId: string;
  successUrl: string;
  failureUrl: string;
  webhookUrl: string;
  description?: string;
}

export interface ChargilyCheckout {
  id: string;
  checkout_url: string;
  status: string;
  amount: number;
  currency: string;
}

export async function createChargilyCheckout(
  params: CreateCheckoutParams,
): Promise<ChargilyCheckout> {
  if (!CHARGILY_API_KEY) {
    throw new Error("CHARGILY_API_KEY is not configured");
  }

  const response = await fetch(`${CHARGILY_BASE_URL}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CHARGILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: "dzd",
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      webhook_endpoint: params.webhookUrl,
      description: params.description,
      locale: CHARGILY_LOCALE,
      metadata: [{ orderId: params.orderId }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Chargily checkout creation failed (${response.status}): ${body}`,
    );
  }

  return response.json();
}

// Every webhook Chargily sends carries a `signature` header: an HMAC-SHA256 of
// the raw request body, keyed with your API secret key. Must be computed over
// the exact raw bytes received — not a re-serialized/re-parsed version of the
// JSON — which is why the webhook route is mounted with a raw body parser
// instead of the app's normal express.json().
export function verifyChargilySignature(
  rawBody: string,
  signature: string,
): boolean {
  if (!CHARGILY_API_KEY || !signature) return false;

  const expected = crypto
    .createHmac("sha256", CHARGILY_API_KEY)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
