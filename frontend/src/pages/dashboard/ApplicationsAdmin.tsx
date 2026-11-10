import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Check, X, Inbox, ShieldAlert } from "lucide-react";
import { sellerApplicationsApi } from "../../api/sellerApplications";
import { ApplicationStatus } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { formatDate } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { CardListSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

export default function ApplicationsAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [status, setStatus] = useState<ApplicationStatus | "">("pending");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["seller-applications", status, page],
    queryFn: () => sellerApplicationsApi.list(status || undefined, page),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      approve ? sellerApplicationsApi.approve(id, note) : sellerApplicationsApi.reject(id, note),
    onSuccess: (app) => {
      qc.invalidateQueries({ queryKey: ["seller-applications"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
      toast.success(app.status === "approved" ? t("dash.apps.opened", { shop: app.shopName }) : t("dash.apps.rejected"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!isSuperAdmin) {
    return <EmptyState icon={ShieldAlert} title={t("dash.restricted")} description={t("dash.apps.restrictedBody")} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.payouts.marketplace")}
        title={t("dash.apps.title")}
        description={t("dash.apps.description")}
        actions={
          <select value={status} onChange={(e) => { setStatus(e.target.value as ApplicationStatus | ""); setPage(1); }}
            className="select" aria-label={t("dash.apps.filter")}>
            <option value="pending">{t("dash.apps.pending")}</option>
            <option value="approved">{t("dash.apps.approved")}</option>
            <option value="rejected">{t("dash.apps.rejectedStatus")}</option>
            <option value="">{t("dash.apps.all")}</option>
          </select>
        }
      />

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : data?.items.length ? (
        <div className="space-y-4">
          {data.items.map((a) => (
            <article key={a.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{a.shopName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.user ? `${a.user.firstName} ${a.user.lastName} · ${a.user.email}` : "—"} · {a.phone} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <span className={STATUS_BADGE[a.status]}>{t(a.status === "pending" ? "dash.apps.pending" : a.status === "approved" ? "dash.apps.approved" : "dash.apps.rejectedStatus")}</span>
              </div>
              {a.description && <p className="mt-3 text-sm text-foreground">{a.description}</p>}
              {a.message && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.message}</p>}
              {a.reviewNote && <p className="mt-2 text-sm italic text-muted-foreground">{t("dash.apps.note", { note: a.reviewNote })}</p>}
              {a.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => confirm(t("dash.apps.confirmApprove", { shop: a.shopName })) &&
                      decide.mutate({ id: a.id, approve: true })}
                    disabled={decide.isPending} className="btn-primary btn-sm">
                    <Check className="h-4 w-4" /> {t("dash.apps.approve")}
                  </button>
                  <button
                    onClick={() => {
                      const note = prompt(t("dash.apps.reasonPrompt"));
                      if (note !== null) decide.mutate({ id: a.id, approve: false, note: note || undefined });
                    }}
                    disabled={decide.isPending} className="btn-outline btn-sm">
                    <X className="h-4 w-4" /> {t("dash.apps.reject")}
                  </button>
                </div>
              )}
            </article>
          ))}
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={Inbox} title={t("dash.apps.emptyTitle")} description={t("dash.apps.emptyBody")} />
      )}
    </div>
  );
}
