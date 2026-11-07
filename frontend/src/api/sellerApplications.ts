import { api } from "./client";
import { ApplicationStatus, Paginated, SellerApplication } from "./types";

export interface SellerApplicationInput {
  shopName: string;
  description?: string;
  phone: string;
  wilayaCode?: number;
  message?: string;
}

export const sellerApplicationsApi = {
  apply: (data: SellerApplicationInput) =>
    api.post<SellerApplication>("/seller-applications", data).then((r) => r.data),
  mine: () => api.get<SellerApplication | null>("/seller-applications/mine").then((r) => r.data),
  // Super admin
  list: (status: ApplicationStatus | undefined, page: number) =>
    api
      .get<Paginated<SellerApplication>>("/seller-applications", { params: { status, page } })
      .then((r) => r.data),
  approve: (id: string, note?: string) =>
    api.post<SellerApplication>(`/seller-applications/${id}/approve`, { note }).then((r) => r.data),
  reject: (id: string, note?: string) =>
    api.post<SellerApplication>(`/seller-applications/${id}/reject`, { note }).then((r) => r.data),
};
