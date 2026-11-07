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

// "" in a price field means "not set": for stop desk that's "not offered".
const toPrice = (v: string) => (v.trim() === "" ? null : Number(v));

export default function ShippingAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
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
      toast.success("Prices applied to every wilaya");
      setAllHome("");
      setAllDesk("");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Restricted area"
        description="Only super admins can change delivery prices."
      />
    );
  }

  function handleBulk(e: FormEvent) {
    e.preventDefault();
    const data: ShippingZoneUpdate = {};
    if (allHome.trim() !== "") data.homePrice = Number(allHome);
    if (allDesk.trim() !== "") data.deskPrice = Number(allDesk);
    if (Object.keys(data).length === 0) return;
    if (confirm("Apply these prices to all 58 wilayas? Individual prices will be overwritten.")) {
      bulkMutation.mutate(data);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Shipping"
        description="What customers pay for delivery to each wilaya. 0 means free; leave stop desk empty where pick-up points aren't offered."
      />

      <form onSubmit={handleBulk} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="allHome" className="label">Home delivery — all wilayas (DA)</label>
          <input id="allHome" type="number" min="0" step="1" value={allHome}
            onChange={(e) => setAllHome(e.target.value)} className="input w-48" placeholder="e.g. 600" />
        </div>
        <div>
          <label htmlFor="allDesk" className="label">Stop desk — all wilayas (DA)</label>
          <input id="allDesk" type="number" min="0" step="1" value={allDesk}
            onChange={(e) => setAllDesk(e.target.value)} className="input w-48" placeholder="e.g. 400" />
        </div>
        <button type="submit" disabled={bulkMutation.isPending || (!allHome && !allDesk)} className="btn-outline">
          Apply to all
        </button>
      </form>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Wilaya</th>
                <th>Home delivery (DA)</th>
                <th>Stop desk (DA)</th>
                <th>Delivered</th>
                <th className="text-right" />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : (
              <tbody>
                {zones?.length ? (
                  zones.map((z) => <ZoneRow key={`${z.code}-${z.homePrice}-${z.deskPrice}-${z.isActive}`} zone={z} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState icon={Truck} title="No wilayas" description="Run the database migrations to load them." className="rounded-none border-0" />
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

function ZoneRow({ zone }: { zone: ShippingZone }) {
  const qc = useQueryClient();
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
      toast.success(`${zone.name} updated`);
    },
    onError: (err: any) => toast.error(String(err)),
  });

  return (
    <tr className={active ? undefined : "opacity-60"}>
      <td>
        <span className="font-medium text-foreground">
          {String(zone.code).padStart(2, "0")} — {zone.name}
        </span>
        <span className="ml-2 text-xs text-muted-foreground" dir="rtl">{zone.nameAr}</span>
      </td>
      <td>
        <input type="number" min="0" step="1" value={home} onChange={(e) => setHome(e.target.value)}
          className="input h-9 w-28" aria-label={`Home delivery price for ${zone.name}`} />
      </td>
      <td>
        <input type="number" min="0" step="1" value={desk} onChange={(e) => setDesk(e.target.value)}
          className="input h-9 w-28" placeholder="Not offered" aria-label={`Stop desk price for ${zone.name}`} />
      </td>
      <td>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]" aria-label={`Deliver to ${zone.name}`} />
      </td>
      <td className="text-right">
        <button onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending} className="btn-primary btn-sm">
          Save
        </button>
      </td>
    </tr>
  );
}
