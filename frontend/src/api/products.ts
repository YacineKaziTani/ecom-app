import { api } from "./client";
import { Product, ProductListResponse } from "./types";

export type ProductSort = "relevance" | "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc" | "rating_desc";

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  shopId?: string;
  sort?: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean; // a promotion is running
  ids?: string; // comma-separated product ids
  page?: number;
  limit?: number;
}

export interface VariantInput {
  id?: string; // existing option being kept / edited
  name: string;
  sku?: string | null;
  price?: number | null; // null = the product's price
  stock: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  dryRun?: boolean;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null; // crossed-out price; null ends the promotion
  stock: number;
  imageUrl?: string; // "" removes the image
  galleryUrls?: string[];
  categoryId?: string | null; // null removes the category
  shopId?: string; // only used/required when the caller is super_admin
  // Replaces the product's options; when there are some, its stock is their total.
  variants?: VariantInput[];
}

export const productsApi = {
  list: (query: ProductQuery = {}) =>
    api.get<ProductListResponse>("/products", { params: query }).then((r) => r.data),
  get: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  related: (id: string) => api.get<Product[]>(`/products/${id}/related`).then((r) => r.data),
  // "Tell me when it's back" (sold-out product or option).
  stockAlert: (id: string, data: { email?: string; variantId?: string | null }) =>
    api.post(`/products/${id}/stock-alerts`, data).then((r) => r.data),
  // CSV text; dryRun only checks it. Rejected files come back as an ApiError
  // whose data.errors lists { line, message }.
  importCsv: (csv: string, opts: { dryRun?: boolean; shopId?: string } = {}) =>
    api.post<ImportResult>("/products/import", { csv, ...opts }).then((r) => r.data),
  create: (data: ProductInput) => api.post<Product>("/products", data).then((r) => r.data),
  update: (id: string, data: Partial<ProductInput>) =>
    api.put<Product>(`/products/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
};
