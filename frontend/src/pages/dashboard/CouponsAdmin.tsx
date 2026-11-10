import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag, Info } from "lucide-react";
import { couponsApi, CouponInput } from "../../api/coupons";
import { Coupon } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { formatDate, formatPrice } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

const emptyForm: CouponInput = {
  code: "",
  type: "percentage",
  value: 10,
  minOrderAmount: undefined,
  maxUses: undefined,
  expiresAt: "",
};

export default function CouponsAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponInput>(emptyForm);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: () => couponsApi.list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coupons"] });

  const createMutation = useMutation({
    mutationFn: couponsApi.create,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.coupons.created"));
      setModalOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: couponsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.coupons.deleted"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      couponsApi.update(id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: CouponInput = {
      ...form,
      code: form.code.trim().toUpperCase(),
      minOrderAmount: form.minOrderAmount || undefined,
      maxUses: form.maxUses || undefined,
      // The picker gives a date; the code stays valid through the end of that day.
      expiresAt: form.expiresAt
        ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
        : undefined,
    };
    createMutation.mutate(payload);
  }

  function statusFor(c: Coupon) {
    if (!c.isActive) return { label: t("dash.coupons.disabled"), className: "badge-neutral" };
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())
      return { label: t("dash.coupons.expired"), className: "badge-danger" };
    if (c.maxUses != null && c.usedCount >= c.maxUses)
      return { label: t("dash.coupons.usedUp"), className: "badge-danger" };
    return { label: t("dash.coupons.active"), className: "badge-success" };
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.coupons.eyebrow")}
        title={t("dash.nav.coupons")}
        description={t("dash.coupons.description")}
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t("dash.coupons.new")}
          </button>
        }
      />

      <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        {isSuperAdmin
          ? t("dash.coupons.platformNote")
          : t("dash.coupons.shopNote")}
      </p>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.coupons.code")}</th>
                <th>{t("dash.coupons.discount")}</th>
                <th className="text-end">{t("dash.coupons.usage")}</th>
                <th>{t("dash.coupons.expires")}</th>
                <th>{t("dash.col.status")}</th>
                <th className="text-end">{t("dash.col.actions")}</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <tbody>
                {coupons?.length ? (
                  coupons.map((c) => {
                    const status = statusFor(c);
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
                            <Tag className="h-3.5 w-3.5 text-accent" />
                            {c.code}
                          </span>
                        </td>

                        <td className="text-foreground">
                          <span className="font-medium">
                            {c.type === "percentage"
                              ? t("dash.coupons.percentOff", { value: Number(c.value) })
                              : t("dash.coupons.amountOff", { amount: formatPrice(c.value) })}
                          </span>
                          {c.minOrderAmount ? (
                            <span className="block text-xs text-muted-foreground">
                              {t("dash.coupons.min", { amount: formatPrice(c.minOrderAmount) })}
                            </span>
                          ) : null}
                        </td>

                        <td className="text-end tabular-nums text-muted-foreground">
                          {c.usedCount}
                          {c.maxUses ? ` / ${c.maxUses}` : ""}
                        </td>

                        <td className="whitespace-nowrap text-muted-foreground">
                          {c.expiresAt ? formatDate(c.expiresAt) : t("dash.coupons.never")}
                        </td>

                        <td>
                          <button
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: c.id,
                                isActive: !c.isActive,
                              })
                            }
                            title={
                              c.isActive ? t("dash.coupons.disable") : t("dash.coupons.enable")
                            }
                            className={`${status.className} transition-opacity hover:opacity-80`}
                          >
                            {status.label}
                          </button>
                        </td>

                        <td className="text-end">
                          <button
                            onClick={() => {
                              if (confirm(t("dash.coupons.confirmDelete", { code: c.code })))
                                deleteMutation.mutate(c.id);
                            }}
                            className="icon-btn-danger"
                            aria-label={t("dash.coupons.delete", { code: c.code })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        icon={Tag}
                        title={t("dash.coupons.emptyTitle")}
                        description={t("dash.coupons.emptyBody")}
                        action={
                          <button
                            onClick={() => setModalOpen(true)}
                            className="btn-primary"
                          >
                            <Plus className="h-4 w-4" />
                            {t("dash.coupons.new")}
                          </button>
                        }
                        className="rounded-none border-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("dash.coupons.new")}
        description={t("dash.coupons.modalHint")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="label">
              {t("dash.coupons.code")}
            </label>
            <input
              id="code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="input font-mono uppercase"
              placeholder="SAVE10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="label">
                {t("dash.coupons.type")}
              </label>
              <select
                id="type"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as "percentage" | "fixed",
                  })
                }
                className="select"
              >
                <option value="percentage">{t("dash.coupons.percentage")}</option>
                <option value="fixed">{t("dash.coupons.fixed")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="value" className="label">
                {t("dash.coupons.value")} {form.type === "percentage" ? "(%)" : "(DA)"}
              </label>
              <input
                id="value"
                type="number"
                step="0.01"
                min="0"
                max={form.type === "percentage" ? 100 : undefined}
                required
                value={form.value}
                onChange={(e) =>
                  setForm({ ...form, value: Number(e.target.value) })
                }
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minOrderAmount" className="label">
                {t("dash.coupons.minOrder")}
              </label>
              <input
                id="minOrderAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.minOrderAmount ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minOrderAmount: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="input"
                placeholder={t("dash.coupons.optional")}
              />
            </div>
            <div>
              <label htmlFor="maxUses" className="label">
                {t("dash.coupons.maxUses")}
              </label>
              <input
                id="maxUses"
                type="number"
                min="1"
                value={form.maxUses ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxUses: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="input"
                placeholder={t("dash.coupons.unlimited")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="expiresAt" className="label">
              {t("dash.coupons.expires")}
            </label>
            <input
              id="expiresAt"
              type="date"
              value={form.expiresAt ? form.expiresAt.slice(0, 10) : ""}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="input"
            />
            <p className="field-hint">{t("dash.coupons.neverHint")}</p>
          </div>

          <div className="flex gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline flex-1"
            >
              {t("dash.cancel")}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1"
            >
              {t("dash.coupons.create")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
