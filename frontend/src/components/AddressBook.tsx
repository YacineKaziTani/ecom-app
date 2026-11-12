import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { addressesApi, AddressInput } from "../api/addresses";
import { shippingApi } from "../api/shipping";
import { Address, ShippingZone } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { Modal } from "./ui/Modal";
import toast from "react-hot-toast";
import { CommuneSelect } from "./CommuneSelect";

export const wilayaLabel = (zones: ShippingZone[] | undefined, code: number) => {
  const zone = zones?.find((z) => z.code === code);
  return zone ? `${String(code).padStart(2, "0")} — ${zone.name}` : String(code);
};

export function useAddresses(enabled = true) {
  return useQuery({ queryKey: ["addresses"], queryFn: addressesApi.list, enabled, staleTime: 60 * 1000 });
}

// The customer's saved delivery addresses, managed from their profile.
export function AddressBook() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: addresses, isLoading } = useAddresses();
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 5 * 60 * 1000 });
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const remove = useMutation({
    mutationFn: addressesApi.remove,
    onSuccess: () => {
      refresh();
      toast.success(t("addresses.deleted"));
    },
    onError: (err: any) => toast.error(String(err)),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => addressesApi.update(id, { isDefault: true }),
    onSuccess: refresh,
    onError: (err: any) => toast.error(String(err)),
  });

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-6 py-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-foreground">{t("addresses.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("addresses.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          disabled={(addresses?.length ?? 0) >= 10}
          className="btn-outline btn-sm"
        >
          <Plus className="h-4 w-4" />
          {t("addresses.add")}
        </button>
      </div>

      <div className="p-6">
        {isLoading ? null : addresses?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <MapPin className="h-4 w-4 text-accent" />
                    {a.label}
                  </p>
                  {a.isDefault && <span className="badge-accent">{t("addresses.default")}</span>}
                </div>
                <p className="mt-2 text-sm text-foreground">{a.address}</p>
                <p className="text-sm text-muted-foreground">
                  {a.commune}, {wilayaLabel(zones, a.wilayaCode)}
                </p>
                <p className="text-sm text-muted-foreground" dir="ltr">{a.phone}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {!a.isDefault && (
                    <button type="button" onClick={() => makeDefault.mutate(a.id)} className="btn-ghost btn-sm">
                      <Star className="h-3.5 w-3.5" />
                      {t("addresses.makeDefault")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    className="icon-btn"
                    aria-label={t("addresses.edit", { label: a.label })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(t("addresses.confirmDelete", { label: a.label })) && remove.mutate(a.id)}
                    className="icon-btn-danger"
                    aria-label={t("addresses.delete", { label: a.label })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("addresses.empty")}</p>
        )}
      </div>

      {editing && (
        <AddressFormModal
          address={editing === "new" ? null : editing}
          zones={zones}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

function AddressFormModal({
  address,
  zones,
  onClose,
  onSaved,
}: {
  address: Address | null;
  zones?: ShippingZone[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    label: address?.label ?? "",
    phone: address?.phone ?? "",
    wilayaCode: (address?.wilayaCode ?? "") as number | "",
    commune: address?.commune ?? "",
    address: address?.address ?? "",
    isDefault: address?.isDefault ?? false,
  });
  const save = useMutation({
    mutationFn: (data: AddressInput) => (address ? addressesApi.update(address.id, data) : addressesApi.create(data)),
    onSuccess: () => {
      onSaved();
      toast.success(t("addresses.saved"));
      onClose();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.wilayaCode === "") return;
    save.mutate({ ...form, wilayaCode: form.wilayaCode });
  }

  return (
    <Modal open onClose={onClose} title={address ? t("addresses.editTitle") : t("addresses.newTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="addr-label" className="label">{t("addresses.label")}</label>
          <input
            id="addr-label"
            required
            maxLength={40}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="input"
            placeholder={t("addresses.labelPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="addr-phone" className="label">{t("cart.phone")}</label>
          <input
            id="addr-phone"
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input"
            placeholder="0550 12 34 56"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="addr-wilaya" className="label">{t("cart.wilaya")}</label>
            <select
              id="addr-wilaya"
              required
              value={form.wilayaCode}
              onChange={(e) => setForm({ ...form, wilayaCode: e.target.value ? Number(e.target.value) : "", commune: "" })}
              className="select"
            >
              <option value="">{t("cart.choose")}</option>
              {zones?.map((z) => (
                <option key={z.code} value={z.code}>
                  {String(z.code).padStart(2, "0")} — {lang === "ar" && z.nameAr ? z.nameAr : z.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="addr-commune" className="label">{t("cart.commune")}</label>
            <CommuneSelect
              id="addr-commune"
              required
              wilayaCode={form.wilayaCode}
              value={form.commune}
              onChange={(commune) => setForm((f) => ({ ...f, commune }))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="addr-address" className="label">{t("cart.address")}</label>
          <textarea
            id="addr-address"
            required
            maxLength={500}
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="textarea"
            placeholder={t("cart.addressPlaceholder")}
          />
        </div>
        {!address?.isDefault && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            {t("addresses.useAsDefault")}
          </label>
        )}
        <div className="flex gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
