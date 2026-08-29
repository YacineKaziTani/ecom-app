import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag, Info } from "lucide-react";
import { couponsApi, CouponInput } from "../../api/coupons";
import { Coupon } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { formatDate } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";

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
      toast.success("Coupon created");
      setModalOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: couponsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success("Coupon deleted");
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
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined,
    };
    createMutation.mutate(payload);
  }

  function statusFor(c: Coupon) {
    if (!c.isActive) return { label: "Disabled", className: "badge-neutral" };
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())
      return { label: "Expired", className: "badge-danger" };
    if (c.maxUses != null && c.usedCount >= c.maxUses)
      return { label: "Used up", className: "badge-danger" };
    return { label: "Active", className: "badge-success" };
  }

  return (
    <div>
      <PageHeader
        eyebrow="Promotions"
        title="Coupons"
        description="Create discount codes and control how often they can be used."
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New coupon
          </button>
        }
      />

      <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        {isSuperAdmin
          ? "Coupons created here are platform-wide and work across any shop."
          : "Coupons you create only apply to orders made up entirely of your shop's products."}
      </p>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th className="text-right">Usage</th>
                <th>Expires</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
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
                              ? `${Number(c.value)}% off`
                              : `$${Number(c.value).toFixed(2)} off`}
                          </span>
                          {c.minOrderAmount ? (
                            <span className="block text-xs text-muted-foreground">
                              min ${Number(c.minOrderAmount).toFixed(2)}
                            </span>
                          ) : null}
                        </td>

                        <td className="text-right tabular-nums text-muted-foreground">
                          {c.usedCount}
                          {c.maxUses ? ` / ${c.maxUses}` : ""}
                        </td>

                        <td className="whitespace-nowrap text-muted-foreground">
                          {c.expiresAt ? formatDate(c.expiresAt) : "Never"}
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
                              c.isActive ? "Disable coupon" : "Enable coupon"
                            }
                            className={`${status.className} transition-opacity hover:opacity-80`}
                          >
                            {status.label}
                          </button>
                        </td>

                        <td className="text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Delete coupon "${c.code}"?`))
                                deleteMutation.mutate(c.id);
                            }}
                            className="icon-btn-danger"
                            aria-label={`Delete coupon ${c.code}`}
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
                        title="No coupons yet"
                        description="Create a discount code to run your first promotion."
                        action={
                          <button
                            onClick={() => setModalOpen(true)}
                            className="btn-primary"
                          >
                            <Plus className="h-4 w-4" />
                            New coupon
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
        title="New coupon"
        description="Codes are case-insensitive and stored in uppercase."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="label">
              Code
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
                Type
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
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label htmlFor="value" className="label">
                Value {form.type === "percentage" ? "(%)" : "($)"}
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
                Min order ($)
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
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="maxUses" className="label">
                Max uses
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
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div>
            <label htmlFor="expiresAt" className="label">
              Expires
            </label>
            <input
              id="expiresAt"
              type="date"
              value={form.expiresAt ? form.expiresAt.slice(0, 10) : ""}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="input"
            />
            <p className="field-hint">Leave blank for a code that never expires.</p>
          </div>

          <div className="flex gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1"
            >
              Create coupon
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
