import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Truck } from "lucide-react";
import { shippingApi, ShippingZoneUpdate } from "../../api/shipping";
import { ShippingZone } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

// "" in a price field means "not set": for stop desk that's "not offered".
const toPrice = (v: string) => (v.trim() === "" ? null : Number(v));

export default function ShippingAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [allHome, setAllHome] = useState("");
  const [allDesk, setAllDesk] = useState("");

  const { data: zones, isLoading } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: shippingApi.zones,
  });

  const bulkMutation = useMutation({
    mutationFn: (data: ShippingZoneUpdate) => shippingApi.updateAll(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones"] });
      toast.success(t("dash.shipping.applied"));
      setAllHome("");
      setAllDesk("");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("dash.restricted")}
        description={t("dash.shipping.restrictedBody")}
      />
    );
  }

  function handleBulk(e: FormEvent) {
    e.preventDefault();
    const data: ShippingZoneUpdate = {};
    if (allHome.trim() !== "") data.homePrice = Number(allHome);
    if (allDesk.trim() !== "") data.deskPrice = Number(allDesk);
    if (Object.keys(data).length === 0) return;
    if (confirm(t("dash.shipping.confirmBulk"))) {
      bulkMutation.mutate(data);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.shipping.eyebrow")}
        title={t("dash.nav.shipping")}
        description={t("dash.shipping.description")}
      />

      <form onSubmit={handleBulk} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="allHome" className="label">{t("dash.shipping.allHome")}</label>
          <input id="allHome" type="number" min="0" step="1" value={allHome}
            onChange={(e) => setAllHome(e.target.value)} className="input w-48" placeholder={t("dash.shipping.example", { amount: 600 })} />
        </div>
        <div>
          <label htmlFor="allDesk" className="label">{t("dash.shipping.allDesk")}</label>
          <input id="allDesk" type="number" min="0" step="1" value={allDesk}
            onChange={(e) => setAllDesk(e.target.value)} className="input w-48" placeholder={t("dash.shipping.example", { amount: 400 })} />
        </div>
        <button type="submit" disabled={bulkMutation.isPending || (!allHome && !allDesk)} className="btn-outline">
          {t("dash.shipping.applyAll")}
        </button>
      </form>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.shipping.wilaya")}</th>
                <th>{t("dash.shipping.home")}</th>
                <th>{t("dash.shipping.desk")}</th>
                <th>{t("dash.shipping.delivered")}</th>
                <th className="text-end" />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : (
              <tbody>
                {zones?.length ? (
                  zones.map((z) => <ZoneRow key={`${z.code}-${z.homePrice}-${z.deskPrice}-${z.isActive}`} zone={z} arabic={lang === "ar"} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState icon={Truck} title={t("dash.shipping.noWilayas")} description={t("dash.shipping.noWilayasBody")} className="rounded-none border-0" />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function ZoneRow({ zone, arabic }: { zone: ShippingZone; arabic: boolean }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  // Arabic speakers read the Arabic wilaya name first.
  const name = arabic && zone.nameAr ? zone.nameAr : zone.name;
  const [home, setHome] = useState(String(zone.homePrice));
  const [desk, setDesk] = useState(zone.deskPrice == null ? "" : String(zone.deskPrice));
  const [active, setActive] = useState(zone.isActive);

  const dirty =
    toPrice(home) !== zone.homePrice ||
    toPrice(desk) !== zone.deskPrice ||
    active !== zone.isActive;

  const mutation = useMutation({
    mutationFn: () =>
      shippingApi.updateZone(zone.code, {
        homePrice: toPrice(home) ?? 0,
        deskPrice: toPrice(desk),
        isActive: active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones"] });
      toast.success(t("dash.shipping.zoneUpdated", { name }));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  return (
    <tr className={active ? undefined : "opacity-60"}>
      <td>
        <span className="font-medium text-foreground">
          {String(zone.code).padStart(2, "0")} — {name}
        </span>
        {!arabic && <span className="ms-2 text-xs text-muted-foreground" dir="rtl">{zone.nameAr}</span>}
      </td>
      <td>
        <input type="number" min="0" step="1" value={home} onChange={(e) => setHome(e.target.value)}
          className="input h-9 w-28" aria-label={t("dash.shipping.homeFor", { name })} />
      </td>
      <td>
        <input type="number" min="0" step="1" value={desk} onChange={(e) => setDesk(e.target.value)}
          className="input h-9 w-28" placeholder={t("dash.shipping.notOffered")} aria-label={t("dash.shipping.deskFor", { name })} />
      </td>
      <td>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]" aria-label={t("dash.shipping.deliverTo", { name })} />
      </td>
      <td className="text-end">
        <button onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending} className="btn-primary btn-sm">
          {t("dash.save")}
        </button>
      </td>
    </tr>
  );
}
