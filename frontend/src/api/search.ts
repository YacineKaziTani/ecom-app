import { api } from "./client";
import { SearchSuggestions } from "./types";

export const searchApi = {
  // Products, categories and shops matching what's typed so far (2+ letters).
  suggest: (q: string) => api.get<SearchSuggestions>("/search/suggest", { params: { q } }).then((r) => r.data),
};
