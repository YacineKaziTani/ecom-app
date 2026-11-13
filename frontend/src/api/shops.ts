import { api } from "./client";
import { Shop } from "./types";

export interface ShopInput {
  name: string;
  description?: string;
  logoUrl?: string;
  // Shop page profile ("" clears a field).
  coverUrl?: string;
  story?: string;
  wilayaCode?: number | null;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

export const shopsApi = {
  list: () => api.get<Shop[]>("/shops").then((r) => r.data),
  bySlug: (slug: string) => api.get<Shop>(`/shops/slug/${slug}`).then((r) => r.data),
  mine: () => api.get<Shop>("/shops/me/mine").then((r) => r.data),
  create: (data: ShopInput) => api.post<Shop>("/shops", data).then((r) => r.data),
  update: (id: string, data: Partial<ShopInput>) => api.put<Shop>(`/shops/${id}`, data).then((r) => r.data),
};
