import { api } from "./client";
import { Product, ProductListResponse } from "./types";

export type ProductSort = "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc";

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  shopId?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string; // "" removes the image
  galleryUrls?: string[];
  categoryId?: string | null; // null removes the category
  shopId?: string; // only used/required when the caller is super_admin
}

export const productsApi = {
  list: (query: ProductQuery = {}) =>
    api.get<ProductListResponse>("/products", { params: query }).then((r) => r.data),
  get: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  create: (data: ProductInput) => api.post<Product>("/products", data).then((r) => r.data),
  update: (id: string, data: Partial<ProductInput>) =>
    api.put<Product>(`/products/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
};
