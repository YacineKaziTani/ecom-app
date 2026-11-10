import { api } from "./client";
import { BlockedPhone, Paginated } from "./types";

// Super admin: numbers that can't use pay on delivery.
export const blockedPhonesApi = {
  list: (page = 1) =>
    api.get<Paginated<BlockedPhone>>("/blocked-phones", { params: { page } }).then((r) => r.data),
  block: (phone: string, reason?: string) =>
    api.post<BlockedPhone>("/blocked-phones", { phone, reason }).then((r) => r.data),
  unblock: (phone: string) => api.delete(`/blocked-phones/${phone}`).then((r) => r.data),
};
