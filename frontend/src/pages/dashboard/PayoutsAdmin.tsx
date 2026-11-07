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

export default function PayoutsAdmin() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <PlatformPayouts /> : <ShopPayouts />;
}

const EXPLAINER =
  "Sales count once the money is in — card orders when paid, pay-on-delivery orders when delivered — and drop out again if an order is cancelled.";

function ShopPayouts() {
  const { data, isLoading } = useQuery({ queryKey: ["payouts", "mine"], queryFn: payoutsApi.mine });

  return (
    <div>
      <PageHeader eyebrow="Earnings" title="Payouts" description={EXPLAINER} />
      {isLoading || !data ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sales" value={formatPrice(data.sales)} icon={Banknote} accent="brand" />
          <StatCard
            label={`Commission (${data.commissionPercent}%)`}
            value={formatPrice(data.commission)}
            icon={Percent}
            accent="amber"
            hint={data.discounts > 0 ? `+ ${formatPrice(data.discounts)} your coupons` : undefined}
          />
          <StatCard label="Paid out" value={formatPrice(data.paidOut)} icon={ArrowDownToLine} accent="blue" />
          <StatCard label="Balance owed to you" value={formatPrice(data.balance)} icon={Wallet} accent="green" />
        </div>
      )}
      <PayoutHistory />
    </div>
  );
}

function PlatformPayouts() {
  const [paying, setPaying] = useState<ShopBalance | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["payouts", "balances"], queryFn: payoutsApi.balances });

  return (
    <div>
      <PageHeader
        eyebrow="Marketplace"
        title="Payouts"
        description={`What each shop is owed (platform commission: ${data?.commissionPercent ?? 0}%). ${EXPLAINER}`}
      />

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Commission</th>
                <th className="text-right">Shop coupons</th>
                <th className="text-right">Paid out</th>
                <th className="text-right">Balance</th>
                <th className="text-right" />
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
                      <td className="text-right tabular-nums">{formatPrice(s.sales)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatPrice(s.commission)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatPrice(s.discounts)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatPrice(s.paidOut)}</td>
                      <td className={cn("text-right font-semibold tabular-nums", s.balance < 0 ? "text-destructive" : "text-foreground")}>
                        {formatPrice(s.balance)}
                      </td>
                      <td className="text-right">
                        <button onClick={() => setPaying(s)} disabled={s.balance <= 0} className="btn-outline btn-sm">
                          Record payout
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState icon={Landmark} title="No shops yet" className="rounded-none border-0" />
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
      toast.success(`Payout to ${shop.shopName} recorded`);
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
      title={`Payout to ${shop.shopName}`}
      description={`Record a transfer you've already made. Owed: ${formatPrice(shop.balance)}.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="amount" className="label">Amount (DA)</label>
          <input id="amount" type="number" min="1" step="0.01" max={shop.balance} required
            value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="reference" className="label">Transfer reference</label>
          <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)}
            className="input" placeholder="CCP / bank transfer number" />
        </div>
        <div>
          <label htmlFor="note" className="label">Note</label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Optional" />
        </div>
        <div className="flex gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">Record payout</button>
        </div>
      </form>
    </Modal>
  );
}

function PayoutHistory({ showShop = false }: { showShop?: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["payouts", "history", page],
    queryFn: () => payoutsApi.list(page),
    placeholderData: keepPreviousData,
  });
  const cols = showShop ? 5 : 4;

  return (
    <section className="mt-8">
      <h2 className="mb-4 font-serif text-xl font-bold text-foreground">Payout history</h2>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {showShop && <th>Shop</th>}
                <th className="text-right">Amount</th>
                <th>Reference</th>
                <th>Note</th>
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
                      <td className="text-right font-medium tabular-nums">{formatPrice(p.amount)}</td>
                      <td className="font-mono text-xs text-muted-foreground">{p.reference || "—"}</td>
                      <td className="text-muted-foreground">{p.note || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={cols} className="p-0">
                      <EmptyState icon={Wallet} title="No payouts yet" className="rounded-none border-0" />
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
