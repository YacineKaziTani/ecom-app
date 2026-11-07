import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { History, ShieldAlert } from "lucide-react";
import { auditLogsApi } from "../../api/auditLogs";
import { useAuth } from "../../store/AuthContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";

const ACTIONS = [
  "order.status_change",
  "order.shipment_update",
  "user.role_change",
  "seller_application.approve",
  "seller_application.reject",
  "payout.create",
  "coupon.create",
  "coupon.update",
  "coupon.delete",
  "product.delete",
  "category.delete",
  "shop.delete",
  "shipping.update",
  "shipping.update_all",
  "auth.2fa_enable",
  "auth.2fa_disable",
];

function formatDetails(details?: Record<string, unknown> | null) {
  if (!details) return "—";
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function ActivityAdmin() {
  const { isSuperAdmin } = useAuth();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action, page],
    queryFn: () => auditLogsApi.list(page, action),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title="Restricted area" description="Only super admins can view activity." />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Activity"
        description="Who changed what in the dashboard."
        actions={
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="select" aria-label="Filter by action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        }
      />
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={8} cols={4} />
            ) : (
              <tbody>
                {data?.items.length ? (
                  data.items.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="text-foreground">{e.actorEmail ?? "system"}</td>
                      <td><span className="badge-neutral font-mono">{e.action}</span></td>
                      <td className="max-w-md truncate text-xs text-muted-foreground" title={formatDetails(e.details)}>
                        {e.entityId ? <span className="font-mono">{e.entityId.slice(0, 8)} · </span> : null}
                        {formatDetails(e.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={History} title="No activity yet" className="rounded-none border-0" />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />}
    </div>
  );
}
