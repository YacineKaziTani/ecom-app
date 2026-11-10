import { api } from "./client";
import { Address } from "./types";

export type AddressInput = Pick<Address, "label" | "phone" | "wilayaCode" | "commune" | "address"> & {
  isDefault?: boolean;
};

// The signed-in customer's saved delivery addresses (default first).
export const addressesApi = {
  list: () => api.get<Address[]>("/addresses").then((r) => r.data),
  create: (data: AddressInput) => api.post<Address>("/addresses", data).then((r) => r.data),
  update: (id: string, data: Partial<AddressInput>) => api.put<Address>(`/addresses/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/addresses/${id}`).then(() => undefined),
};
