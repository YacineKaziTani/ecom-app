import { api } from "./client";
import { PaymentMethod } from "./types";

export interface StoreConfig {
  paymentMethods: PaymentMethod[];
  reservationMinutes: number;
  // Pay-on-delivery orders at or above this total need an SMS code (null = off).
  codOtpMinTotal: number | null;
}

export const configApi = {
  get: () => api.get<StoreConfig>("/config").then((r) => r.data),
};
