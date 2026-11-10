import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Wallet, Banknote, Percent, ArrowDownToLine, Landmark } from "lucide-react";
import { payoutsApi } from "../../api/payouts";
import { ShopBalance } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { formatDate, formatPrice } from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/StatCard";
import { Pagination } from "../../components/Pagination";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n/I18nProvider";

export default function PayoutsAdmin() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <PlatformPayouts /> : <ShopPayouts />;
}

function ShopPayouts() {
  const { data, isLoading } = useQuery({ queryKey: ["payouts", "mine"], queryFn: payoutsApi.mine });
  const { t } = useI18n();

  return (
    <div>
      <PageHeader eyebrow={t("dash.payouts.earnings")} title={t("dash.nav.payouts")} description={t("dash.payouts.explainer")} />
      {isLoading || !data ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("dash.payouts.sales")} value={formatPrice(data.sales)} icon={Banknote} accent="brand" />
          <StatCard
            label={t("dash.payouts.commissionPct", { percent: data.commissionPercent })}
            value={formatPrice(data.commission)}
            icon={Percent}
            accent="amber"
            hint={data.discounts > 0 ? t("dash.payouts.yourCoupons", { amount: formatPrice(data.discounts) }) : undefined}
          />
          <StatCard label={t("dash.payouts.paidOut")} value={formatPrice(data.paidOut)} icon={ArrowDownToLine} accent="blue" />
          <StatCard label={t("dash.payouts.owed")} value={formatPrice(data.balance)} icon={Wallet} accent="green" />
        </div>
      )}
      <PayoutHistory />
    </div>
  );
}

function PlatformPayouts() {
  const [paying, setPaying] = useState<ShopBalance | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["payouts", "balances"], queryFn: payoutsApi.balances });
  const { t } = useI18n();

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.payouts.marketplace")}
        title={t("dash.nav.payouts")}
        description={t("dash.payouts.platformDescription", { percent: data?.commissionPercent ?? 0, explainer: t("dash.payouts.explainer") })}
      />

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.col.shop")}</th>
                <th className="text-end">{t("dash.payouts.sales")}</th>
                <th className="text-end">{t("dash.payouts.commission")}</th>
                <th className="text-end">{t("dash.payouts.shopCoupons")}</th>
                <th className="text-end">{t("dash.payouts.paidOut")}</th>
                <th className="text-end">{t("dash.payouts.balance")}</th>
                <th className="text-end" />
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={4} cols={7} />
            ) : (
              <tbody>
                {data?.shops.length ? (
                  data.shops.map((s) => (
                    <tr key={s.shopId}>
                      <td className="font-medium text-foreground">{s.shopName}</td>
                      <td className="text-end tabular-nums">{formatPrice(s.sales)}</td>
                      <td className="text-end tabular-nums text-muted-foreground">{formatPrice(s.commission)}</td>
                      <td className="text-end tabular-nums text-muted-foreground">{formatPrice(s.discounts)}</td>
                      <td className="text-end tabular-nums text-muted-foreground">{formatPrice(s.paidOut)}</td>
                      <td className={cn("text-end font-semibold tabular-nums", s.balance < 0 ? "text-destructive" : "text-foreground")}>
                        {formatPrice(s.balance)}
                      </td>
                      <td className="text-end">
                        <button onClick={() => setPaying(s)} disabled={s.balance <= 0} className="btn-outline btn-sm">
                          {t("dash.payouts.record")}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState icon={Landmark} title={t("dash.payouts.noShops")} className="rounded-none border-0" />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <PayoutHistory showShop />
      {paying && <RecordPayoutModal shop={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function RecordPayoutModal({ shop, onClose }: { shop: ShopBalance; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(shop.balance));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      payoutsApi.create({
        shopId: shop.shopId,
        amount: Number(amount),
        reference: reference || undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      toast.success(t("dash.payouts.recorded", { shop: shop.shopName }));
      onClose();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("dash.payouts.modalTitle", { shop: shop.shopName })}
      description={t("dash.payouts.modalDescription", { amount: formatPrice(shop.balance) })}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="amount" className="label">{t("dash.payouts.amount")}</label>
          <input id="amount" type="number" min="1" step="0.01" max={shop.balance} required
            value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="reference" className="label">{t("dash.payouts.reference")}</label>
          <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)}
            className="input" placeholder={t("dash.payouts.referencePlaceholder")} />
        </div>
        <div>
          <label htmlFor="note" className="label">{t("dash.payouts.note")}</label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder={t("dash.coupons.optional")} />
        </div>
        <div className="flex gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">{t("dash.cancel")}</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">{t("dash.payouts.record")}</button>
        </div>
      </form>
    </Modal>
  );
}

function PayoutHistory({ showShop = false }: { showShop?: boolean }) {
  const [page, setPage] = useState(1);
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["payouts", "history", page],
    queryFn: () => payoutsApi.list(page),
    placeholderData: keepPreviousData,
  });
  const cols = showShop ? 5 : 4;

  return (
    <section className="mt-8">
      <h2 className="mb-4 font-serif text-xl font-bold text-foreground">{t("dash.payouts.history")}</h2>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.col.date")}</th>
                {showShop && <th>{t("dash.col.shop")}</th>}
                <th className="text-end">{t("dash.payouts.amountCol")}</th>
                <th>{t("dash.payouts.reference")}</th>
                <th>{t("dash.payouts.note")}</th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={3} cols={cols} />
            ) : (
              <tbody>
                {data?.items.length ? (
                  data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</td>
                      {showShop && <td className="text-foreground">{p.shop?.name ?? "—"}</td>}
                      <td className="text-end font-medium tabular-nums">{formatPrice(p.amount)}</td>
                      <td className="font-mono text-xs text-muted-foreground">{p.reference || "—"}</td>
                      <td className="text-muted-foreground">{p.note || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={cols} className="p-0">
                      <EmptyState icon={Wallet} title={t("dash.payouts.noPayouts")} className="rounded-none border-0" />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
      )}
    </section>
  );
}
