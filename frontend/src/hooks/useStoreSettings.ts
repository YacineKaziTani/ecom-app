import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "../api/settings";

export const STORE_SETTINGS_KEY = ["store-settings"] as const;

// The store's contact details and policies, shared by the Contact page, the
// WhatsApp button, the footer and the legal pages.
export function useStoreSettings() {
  return useQuery({ queryKey: STORE_SETTINGS_KEY, queryFn: settingsApi.get, staleTime: 5 * 60 * 1000 });
}
