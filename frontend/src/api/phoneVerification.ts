import { api } from "./client";

export const phoneVerificationApi = {
  // Texts a 6-digit code to the number (checkout, larger COD orders).
  request: (phone: string) =>
    api.post<{ message: string; expiresInMinutes: number }>("/phone-verifications", { phone }).then((r) => r.data),
};
