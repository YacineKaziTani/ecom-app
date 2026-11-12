import { AppDataSource } from "../config/data-source";
import { StoreSettings } from "../entities/StoreSettings";

export type StoreSettingsView = Omit<StoreSettings, "id" | "updatedAt"> & { updatedAt: Date | null };

const DEFAULTS: StoreSettingsView = {
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
  updatedAt: null,
};

const repo = () => AppDataSource.getRepository(StoreSettings);

function view(row: StoreSettings | null): StoreSettingsView {
  if (!row) return { ...DEFAULTS };
  const { id: _id, ...rest } = row;
  return rest;
}

// The saved details, or the defaults until a super admin fills them in.
export async function getStoreSettings(): Promise<StoreSettingsView> {
  return view(await repo().findOne({ where: { id: 1 } }));
}

export async function updateStoreSettings(changes: Partial<Omit<StoreSettingsView, "updatedAt">>): Promise<StoreSettingsView> {
  const current = await repo().findOne({ where: { id: 1 } });
  const { updatedAt: _updatedAt, ...base } = view(current);
  return view(await repo().save(repo().create({ ...base, ...changes, id: 1 })));
}
