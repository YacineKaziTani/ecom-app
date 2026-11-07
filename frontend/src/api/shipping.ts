import { api } from "./client";
import { ShippingZone } from "./types";

export interface ShippingZoneUpdate {
  homePrice?: number;
  deskPrice?: number | null; // null = no stop-desk option
  isActive?: boolean;
}

export const shippingApi = {
  // Every wilaya with its delivery prices (inactive ones included).
  zones: () => api.get<ShippingZone[]>("/shipping/zones").then((r) => r.data),
  // Super admin only.
  updateZone: (code: number, data: ShippingZoneUpdate) =>
    api.patch<ShippingZone>(`/shipping/zones/${code}`, data).then((r) => r.data),
  updateAll: (data: ShippingZoneUpdate) =>
    api.patch("/shipping/zones", data).then((r) => r.data),
};
