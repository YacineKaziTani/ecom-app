import { useStoreSettings } from "./useStoreSettings";
import { DEFAULT_BRAND } from "../lib/brand";

// The shop's name and logo (Dashboard → Store info).
export function useBrand() {
  const { data } = useStoreSettings();
  return { name: data?.brandName || DEFAULT_BRAND, logoUrl: data?.logoUrl ?? null };
}
