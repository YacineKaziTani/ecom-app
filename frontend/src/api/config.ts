import { api } from "./client";
import { PaymentMethod } from "./types";

export interface StoreConfig {
  paymentMethods: PaymentMethod[];
  reservationMinutes: number;
}

export const configApi = {
  get: () => api.get<StoreConfig>("/config").then((r) => r.data),
};
