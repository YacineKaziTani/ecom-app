import { api } from "./client";
import { WishlistItem } from "./types";

export const wishlistApi = {
  list: () => api.get<WishlistItem[]>("/wishlist").then((r) => r.data),
  add: (productId: string) => api.post("/wishlist", { productId }).then((r) => r.data),
  remove: (productId: string) => api.delete(`/wishlist/${productId}`).then((r) => r.data),
};
