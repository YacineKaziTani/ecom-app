import crypto from "crypto";

// AES-256-GCM for small secrets at rest (the 2FA seeds), so a database leak
// alone doesn't let anyone generate an admin's codes.
//
// Key: TOTP_ENCRYPTION_KEY (recommended — set once, never change it). Without
// it the key is derived from JWT_SECRET, so rotating JWT_SECRET would turn
// existing 2FA seeds unreadable; affected admins then sign in with a recovery
// code and set 2FA up again.
function key(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY || `totp:${process.env.JWT_SECRET}`;
  return crypto.createHash("sha256").update(material).digest();
}

export function seal(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered value
  }
}
