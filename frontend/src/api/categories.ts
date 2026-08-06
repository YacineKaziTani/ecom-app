import { api } from "./client";
import { Category } from "./types";

export interface CategoryInput {
  name: string;
  description?: string;
  imageUrl?: string;
}

export const categoriesApi = {
  list: () => api.get<Category[]>("/categories").then((r) => r.data),
  get: (id: string) => api.get<Category>(`/categories/${id}`).then((r) => r.data),
  create: (data: CategoryInput) => api.post<Category>("/categories", data).then((r) => r.data),
  update: (id: string, data: Partial<CategoryInput>) =>
    api.put<Category>(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};
