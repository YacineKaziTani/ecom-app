import { api } from "./client";
import { StoreSettings } from "./types";

export type StoreSettingsInput = Partial<Omit<StoreSettings, "updatedAt">>;

export const settingsApi = {
  get: () => api.get<StoreSettings>("/settings").then((r) => r.data),
  // Super admin only. "" clears a text field.
  update: (data: Record<string, string | number>) => api.put<StoreSettings>("/settings", data).then((r) => r.data),
};
