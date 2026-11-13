import { AppDataSource } from "../config/data-source";
import { StoreSettings } from "../entities/StoreSettings";

export type StoreSettingsView = Omit<StoreSettings, "id" | "updatedAt" | "featuredShop"> & { updatedAt: Date | null };

const DEFAULTS: StoreSettingsView = {
  brandName: "ArtisanShop",
  logoUrl: null,
  legalName: null,
  registerNumber: null,
  taxId: null,
  address: null,
  phone: null,
  whatsapp: null,
  email: null,
  openingHours: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  deliveryDaysMin: 2,
  deliveryDaysMax: 7,
  exchangeDays: 7,
  freeShippingThreshold: null,
  facebookPixelId: null,
  tiktokPixelId: null,
  featuredShopId: null,
  updatedAt: null,
};

const repo = () => AppDataSource.getRepository(StoreSettings);

// The shop's name and logo as last read, for code that renders without a
// database round trip (emails, SMS). Refreshed by every read and save.
let brand = { name: DEFAULTS.brandName, logoUrl: DEFAULTS.logoUrl };
export const currentBrand = () => brand;
function remember(settings: StoreSettingsView): StoreSettingsView {
  brand = { name: settings.brandName, logoUrl: settings.logoUrl };
  return settings;
}

function view(row: StoreSettings | null): StoreSettingsView {
  if (!row) return { ...DEFAULTS };
  const { id: _id, featuredShop: _shop, ...rest } = row;
  return rest;
}

// The saved details, or the defaults until a super admin fills them in.
export async function getStoreSettings(): Promise<StoreSettingsView> {
  return remember(view(await repo().findOne({ where: { id: 1 } })));
}

// `current`: the settings the caller already loaded, to skip reading them again.
export async function updateStoreSettings(
  changes: Partial<Omit<StoreSettingsView, "updatedAt">>,
  current?: StoreSettingsView,
): Promise<StoreSettingsView> {
  const { updatedAt: _updatedAt, ...base } = current ?? (await getStoreSettings());
  return remember(view(await repo().save(repo().create({ ...base, ...changes, id: 1 }))));
}
