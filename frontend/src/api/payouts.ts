import { api } from "./client";
import { Paginated, Payout, ShopBalance } from "./types";

export interface PayoutInput {
  shopId: string;
  amount: number;
  reference?: string;
  note?: string;
}

export const payoutsApi = {
  // Super admin: every shop's balance.
  balances: () =>
    api
      .get<{ commissionPercent: number; shops: ShopBalance[] }>("/payouts/balances")
      .then((r) => r.data),
  // Shop admin: their own balance.
  mine: () =>
    api.get<ShopBalance & { commissionPercent: number }>("/payouts/mine").then((r) => r.data),
  list: (page = 1, shopId?: string) =>
    api
      .get<Paginated<Payout>>("/payouts", { params: { page, shopId } })
      .then((r) => r.data),
  create: (data: PayoutInput) => api.post<Payout>("/payouts", data).then((r) => r.data),
};
