import { api } from "./client";
import { Review, ReviewList } from "./types";

export const reviewsApi = {
  list: (productId: string, page = 1) =>
    api.get<ReviewList>(`/products/${productId}/reviews`, { params: { page } }).then((r) => r.data),
  save: (productId: string, data: { rating: number; comment?: string }) =>
    api.post<Review>(`/products/${productId}/reviews`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/reviews/${id}`).then((r) => r.data),
};
