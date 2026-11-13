import { currentBrand } from "../services/storeSettings";
import crypto from "crypto";

// Time-based one-time passwords (RFC 6238 / RFC 4226): SHA-1, 6 digits, 30s
// steps — what Google Authenticator, Authy, Microsoft Authenticator etc. use.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160-bit key, as RFC 4226 recommends
}

function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

export function currentStep(timeMs = Date.now()): number {
  return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, timeMs = Date.now(), digits = 6): string {
  return hotp(base32Decode(secret), currentStep(timeMs), digits);
}

// Returns the matching time step (to block replays), or null. Accepts the
// previous/next step too, to tolerate small clock drift on the phone.
export function verifyTotp(
  secret: string,
  code: string,
  timeMs = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const step = currentStep(timeMs);
  for (let offset = -window; offset <= window; offset++) {
    const candidate = hotp(key, step + offset);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return step + offset;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer = currentBrand().name): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// Recovery codes: "ABCD-EFGH-JKLM" style, shown once, stored hashed.
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    base32Encode(crypto.randomBytes(8)).slice(0, 12).replace(/(.{4})(?=.)/g, "$1-"),
  );
}

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.toUpperCase().replace(/[^A-Z2-7]/g, ""))
    .digest("hex");
}
