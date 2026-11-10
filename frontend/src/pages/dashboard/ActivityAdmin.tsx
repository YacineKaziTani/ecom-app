import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { History, ShieldAlert } from "lucide-react";
import { auditLogsApi } from "../../api/auditLogs";
import { useAuth } from "../../store/AuthContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import type { MessageKey } from "../../i18n/messages";
import { useI18n } from "../../i18n/I18nProvider";

// Every action the backend records (services/audit.ts callers), with its label.
const ACTION_LABELS: Record<string, MessageKey> = {
  "order.status_change": "dash.action.order.status_change",
  "order.shipment_update": "dash.action.order.shipment_update",
  "order.call": "dash.action.order.call",
  "user.role_change": "dash.action.user.role_change",
  "seller_application.approve": "dash.action.seller_application.approve",
  "seller_application.reject": "dash.action.seller_application.reject",
  "payout.create": "dash.action.payout.create",
  "coupon.create": "dash.action.coupon.create",
  "coupon.update": "dash.action.coupon.update",
  "coupon.delete": "dash.action.coupon.delete",
  "product.delete": "dash.action.product.delete",
  "product.import": "dash.action.product.import",
  "category.delete": "dash.action.category.delete",
  "shop.delete": "dash.action.shop.delete",
  "review.delete": "dash.action.review.delete",
  "shipping.update": "dash.action.shipping.update",
  "shipping.update_all": "dash.action.shipping.update_all",
  "auth.2fa_enable": "dash.action.auth.2fa_enable",
  "auth.2fa_disable": "dash.action.auth.2fa_disable",
  "phone.block": "dash.action.phone.block",
  "phone.unblock": "dash.action.phone.unblock",
};
const ACTIONS = Object.keys(ACTION_LABELS);

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
  const { t, lang } = useI18n();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action, page],
    queryFn: () => auditLogsApi.list(page, action),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title={t("dash.restricted")} description={t("dash.activity.restrictedBody")} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.activity.eyebrow")}
        title={t("dash.nav.activity")}
        description={t("dash.activity.description")}
        actions={
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="select" aria-label={t("dash.activity.filter")}>
            <option value="">{t("dash.activity.allActions")}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{t(ACTION_LABELS[a])}</option>)}
          </select>
        }
      />
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.activity.when")}</th>
                <th>{t("dash.activity.who")}</th>
                <th>{t("dash.activity.action")}</th>
                <th>{t("dash.activity.details")}</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={8} cols={4} />
            ) : (
              <tbody>
                {data?.items.length ? (
                  data.items.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-muted-foreground">{new Date(e.createdAt).toLocaleString(lang)}</td>
                      <td className="text-foreground">{e.actorEmail ?? t("dash.activity.system")}</td>
                      <td><span className="badge-neutral" title={e.action}>{ACTION_LABELS[e.action] ? t(ACTION_LABELS[e.action]) : e.action}</span></td>
                      <td className="max-w-md truncate text-xs text-muted-foreground" title={formatDetails(e.details)}>
                        {e.entityId ? <span className="font-mono">{e.entityId.slice(0, 8)} · </span> : null}
                        {formatDetails(e.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={History} title={t("dash.activity.empty")} className="rounded-none border-0" />
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
