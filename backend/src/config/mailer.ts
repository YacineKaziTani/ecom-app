import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

export const MAIL_FROM = process.env.MAIL_FROM || "Artisan Shop <no-reply@artisanshop.example>";

// Verify the SMTP connection once at startup so misconfiguration shows up in
// the logs immediately instead of silently failing on the first real order.
export async function verifyMailer() {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP not configured — order confirmation emails will be skipped. Set SMTP_* vars in .env to enable them.");
    return;
  }
  try {
    await transporter.verify();
    console.log("SMTP connection verified — order confirmation emails are enabled.");
  } catch (err) {
    console.error("SMTP verification failed — emails will fail to send:", err);
  }
}
