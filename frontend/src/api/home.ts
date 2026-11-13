import { api } from "./client";
import { HomeBanner, HomeData } from "./types";

export type BannerInput = Omit<HomeBanner, "id" | "position" | "isActive"> & { isActive?: boolean };

export const homeApi = {
  get: () => api.get<HomeData>("/home").then((r) => r.data),
  // Super admin.
  banners: () => api.get<HomeBanner[]>("/home/banners").then((r) => r.data),
  createBanner: (data: BannerInput) => api.post<HomeBanner>("/home/banners", data).then((r) => r.data),
  updateBanner: (id: string, data: Partial<BannerInput>) =>
    api.put<HomeBanner>(`/home/banners/${id}`, data).then((r) => r.data),
  reorderBanners: (ids: string[]) => api.put<HomeBanner[]>("/home/banners-order", { ids }).then((r) => r.data),
  deleteBanner: (id: string) => api.delete(`/home/banners/${id}`),
};
