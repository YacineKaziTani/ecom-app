import { api } from "./client";

export const paymentsApi = {
  createCheckout: (orderId: string) =>
    api.post<{ checkoutUrl: string }>("/payments/create-checkout", { orderId }).then((r) => r.data),
};
