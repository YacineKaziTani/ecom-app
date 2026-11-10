import { Router } from "express";
import { z } from "zod";
import { algerianPhoneSchema } from "../utils/validators";
import { phoneCodeLimiter } from "../middleware/rateLimit";
import { requestPhoneCode } from "../services/phoneVerification";
import { smsEnabled } from "../services/sms";

// Public: texts a checkout confirmation code (see COD_OTP_MIN_TOTAL).
const router = Router();

router.post("/", phoneCodeLimiter, async (req, res) => {
  if (!smsEnabled()) return res.status(404).json({ message: "SMS codes aren't enabled" });
  const parsed = z.object({ phone: algerianPhoneSchema }).safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Enter a valid Algerian mobile number" });
  await requestPhoneCode(parsed.data.phone);
  res.json({ message: "Code sent", expiresInMinutes: 10 });
});

export default router;
