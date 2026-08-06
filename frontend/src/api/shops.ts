import { api } from "./client";
import { Shop } from "./types";

export interface ShopInput {
  name: string;
  description?: string;
  logoUrl?: string;
}

export const shopsApi = {
  list: () => api.get<Shop[]>("/shops").then((r) => r.data),
  get: (id: string) => api.get<Shop>(`/shops/${id}`).then((r) => r.data),
  bySlug: (slug: string) => api.get<Shop>(`/shops/slug/${slug}`).then((r) => r.data),
  mine: () => api.get<Shop>("/shops/me/mine").then((r) => r.data),
  create: (data: ShopInput) => api.post<Shop>("/shops", data).then((r) => r.data),
  update: (id: string, data: Partial<ShopInput>) => api.put<Shop>(`/shops/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/shops/${id}`).then((r) => r.data),
};
