import { api } from "./client";

export const paymentsApi = {
  // `email` is required for guest orders (the address used at checkout).
  createCheckout: (orderId: string, email?: string) =>
    api
      .post<{ checkoutUrl: string }>("/payments/create-checkout", { orderId, email })
      .then((r) => r.data),
};
