import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, Tag } from "lucide-react";
import { couponsApi, CouponInput } from "../../api/coupons";
import { Coupon } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
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
    if (!c.isActive)
      return { label: "Disabled", className: "bg-gray-100 text-gray-500" };
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())
      return { label: "Expired", className: "bg-red-100 text-red-600" };
    if (c.maxUses != null && c.usedCount >= c.maxUses)
      return { label: "Used up", className: "bg-red-100 text-red-600" };
    return { label: "Active", className: "bg-green-100 text-green-700" };
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Coupons
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>
      {!isSuperAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Coupons you create only apply to orders made up entirely of your
          shop's products.
        </p>
      )}
      {isSuperAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">
          Coupons created here are platform-wide and work across any shop.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Usage</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : coupons?.length ? (
              coupons.map((c) => {
                const status = statusFor(c);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.type === "percentage"
                        ? `${Number(c.value)}%`
                        : `$${Number(c.value).toFixed(2)}`}
                      {c.minOrderAmount
                        ? ` (min $${Number(c.minOrderAmount).toFixed(2)})`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: c.id,
                            isActive: !c.isActive,
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 ${status.className}`}
                      >
                        {status.label}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete coupon "${c.code}"?`))
                            deleteMutation.mutate(c.id);
                        }}
                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-foreground">
                New coupon
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Code
                </label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 font-mono uppercase text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                  placeholder="SAVE10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as "percentage" | "fixed",
                      })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Value {form.type === "percentage" ? "(%)" : "($)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === "percentage" ? 100 : undefined}
                    required
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Min order ($)
                  </label>
                  <input
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
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Max uses
                  </label>
                  <input
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
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Expires
                </label>
                <input
                  type="date"
                  value={form.expiresAt ? form.expiresAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    setForm({ ...form, expiresAt: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Create coupon
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
