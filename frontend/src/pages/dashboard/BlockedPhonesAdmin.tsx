import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Ban, ShieldAlert } from "lucide-react";
import { blockedPhonesApi } from "../../api/blockedPhones";
import { useAuth } from "../../store/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import { formatDate } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import toast from "react-hot-toast";

export default function BlockedPhonesAdmin() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["blocked-phones", page],
    queryFn: () => blockedPhonesApi.list(page),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    mutationFn: () => blockedPhonesApi.block(phone, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-phones"] });
      setPhone("");
      setReason("");
      toast.success(t("dash.blocked.added"));
    },
    onError: (err: any) => toast.error(String(err)),
  });
  const remove = useMutation({
    mutationFn: blockedPhonesApi.unblock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-phones"] });
      toast.success(t("dash.blocked.removed"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title={t("dash.restricted")} description={t("dash.superAdminOnly")} />;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <div>
      <PageHeader eyebrow={t("dash.blocked.eyebrow")} title={t("dash.blocked.title")} description={t("dash.blocked.description")} />

      <form onSubmit={handleSubmit} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="bp-phone" className="label">{t("dash.blocked.phone")}</label>
          <input id="bp-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-48" placeholder="0550 12 34 56" />
        </div>
        <div className="min-w-56 flex-1">
          <label htmlFor="bp-reason" className="label">{t("dash.blocked.reason")}</label>
          <input id="bp-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="input" />
        </div>
        <button type="submit" disabled={add.isPending} className="btn-primary">
          <Ban className="h-4 w-4" />
          {t("dash.blocked.add")}
        </button>
      </form>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.blocked.phone")}</th>
                <th>{t("dash.blocked.reason")}</th>
                <th>{t("dash.blocked.since")}</th>
                <th className="text-end" />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : (
              <tbody>
                {data?.items.length ? (
                  data.items.map((b) => (
                    <tr key={b.phone}>
                      <td className="font-mono text-foreground" dir="ltr">{b.phone}</td>
                      <td className="text-muted-foreground">{b.reason || "—"}</td>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDate(b.createdAt)}</td>
                      <td className="text-end">
                        <button
                          onClick={() => confirm(t("dash.blocked.confirmRemove", { phone: b.phone })) && remove.mutate(b.phone)}
                          className="btn-outline btn-sm"
                        >
                          {t("dash.blocked.remove")}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={Ban} title={t("dash.blocked.emptyTitle")} description={t("dash.blocked.emptyBody")} className="rounded-none border-0" />
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
