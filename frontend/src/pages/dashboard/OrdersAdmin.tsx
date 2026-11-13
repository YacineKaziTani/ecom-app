import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ClipboardList, Info, PhoneCall } from "lucide-react";
import { ordersApi } from "../../api/orders";
import { Order, OrderStatus } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import {
  orderStatusBadge,
  paymentBadge,
  paymentLabelKey,
  deliveryLine,
  formatPrice,
  formatDate,
} from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import { RiskBadge } from "../../components/RiskBadge";
import { CallModal } from "../../components/CallModal";
import { cn } from "@/lib/utils";
import { itemLabel } from "../../lib/cart";
import toast from "react-hot-toast";

const statuses: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled", "returned"];
const CLOSED: OrderStatus[] = ["cancelled", "returned"];

export default function OrdersAdmin() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [calling, setCalling] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "admin", { page, status: statusFilter }],
    queryFn: () => ordersApi.list({ page, limit: 20, status: statusFilter || undefined }),
    placeholderData: keepPreviousData,
  });
  const orders = data?.items;

  const onOrderChanged = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] }); // stock may have changed
  };

  const updateMutation = useMutation({
    mutationFn: (v: { id: string; status: OrderStatus; returnReason?: string; returnCost?: number }) =>
      ordersApi.updateStatus(v.id, v.status, { returnReason: v.returnReason, returnCost: v.returnCost }),
    onSuccess: (_data, v) => {
      onOrderChanged();
      toast.success(
        v.status === "cancelled"
          ? t("dash.orders.cancelled")
          : v.status === "returned"
            ? t("dash.orders.returned")
            : t("dash.orders.updated"),
      );
    },
    onError: (err: any) => {
      const issues = err?.data?.issues;
      if (issues?.length) {
        const names = issues.map((i: any) => itemLabel(i.productName || "—", i.variantName)).join(", ");
        toast.error(t("dash.orders.cantReactivate", { names }), { duration: 6000 });
      } else {
        toast.error(String(err));
      }
    },
  });

  // A shop admin moves their own shipment forward; the order's status
  // follows the slowest shop. Cancel / return / reactivate stay order-level.
  const shipmentMutation = useMutation({
    mutationFn: (v: { orderId: string; shopId: string; status: OrderStatus; trackingNumber?: string | null }) =>
      ordersApi.updateShipment(v.orderId, v.shopId, {
        status: v.status,
        ...(v.trackingNumber !== undefined ? { trackingNumber: v.trackingNumber } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("dash.orders.shipmentUpdated"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleStatusChange(order: Order, newStatus: OrderStatus) {
    const myShipment = !isSuperAdmin ? order.shipments?.[0] : undefined;
    const closing = CLOSED.includes(newStatus);
    if (myShipment && !closing && !CLOSED.includes(order.status)) {
      let trackingNumber: string | null | undefined;
      if (newStatus === "shipped") {
        const entered = prompt(t("dash.orders.trackingPrompt"), myShipment.trackingNumber ?? "");
        if (entered === null) return;
        trackingNumber = entered.trim() || null;
      }
      shipmentMutation.mutate({ orderId: order.id, shopId: myShipment.shopId, status: newStatus, trackingNumber });
      return;
    }

    if (newStatus === "cancelled" && !confirm(t("dash.orders.confirmCancel"))) return;
    if (newStatus === "returned") {
      const reason = prompt(t("dash.orders.returnReasonPrompt"));
      if (reason === null) return;
      const cost = prompt(t("dash.orders.returnCostPrompt"), "0");
      if (cost === null) return;
      updateMutation.mutate({
        id: order.id,
        status: newStatus,
        returnReason: reason.trim() || undefined,
        returnCost: Number(cost) > 0 ? Number(cost) : undefined,
      });
      return;
    }
    if (CLOSED.includes(order.status) && !closing && !confirm(t("dash.orders.confirmReactivate"))) return;
    updateMutation.mutate({ id: order.id, status: newStatus });
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.orders.eyebrow")}
        title={t("dash.orders.title")}
        description={t("dash.orders.description")}
        actions={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            aria-label={t("dash.orders.filterLabel")}
            className="select"
          >
            <option value="">{t("dash.orders.allStatuses")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        }
      />

      {!isSuperAdmin && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {t("dash.orders.scopedNote")}
        </p>
      )}

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.col.order")}</th>
                <th>{t("dash.col.customer")}</th>
                {/* Below 1536px the date moves under the order number and the
                    item count goes, so the status column stays in view. */}
                <th className="hidden 2xl:table-cell">{t("dash.col.date")}</th>
                <th className="hidden text-end 2xl:table-cell">{t("dash.col.items")}</th>
                <th className="text-end">{t("dash.col.total")}</th>
                <th>{t("dash.col.payment")}</th>
                <th>{t("dash.col.status")}</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton rows={5} cols={7} />
            ) : (
              <tbody>
                {orders?.length ? (
                  orders.map((o) => {
                    const total = isSuperAdmin
                      ? Number(o.total)
                      : o.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
                    const myShipment = !isSuperAdmin ? o.shipments?.[0] : undefined;
                    const shown: OrderStatus = CLOSED.includes(o.status) ? o.status : myShipment?.status ?? o.status;
                    const awaitingCall = o.paymentMethod === "cod" && o.status === "pending";
                    return (
                      <tr key={o.id}>
                        <td>
                          <span className="font-mono text-xs font-semibold text-accent">#{o.id.slice(0, 8)}</span>
                          <span className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground 2xl:hidden">
                            {formatDate(o.createdAt)}
                          </span>
                        </td>
                        <td className="text-foreground">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {o.user ? (
                              `${o.user.firstName} ${o.user.lastName}`
                            ) : o.guestEmail ? (
                              <span>
                                {o.guestName || o.guestEmail}
                                <span className="ms-1.5 text-xs text-muted-foreground">{t("dash.orders.guest")}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                            <RiskBadge risk={o.customerRisk} />
                          </span>
                          {(o.phone || deliveryLine(o)) && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {[deliveryLine(o), o.phone].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">{formatDate(o.createdAt)}</td>
                        <td className="hidden text-end tabular-nums text-muted-foreground 2xl:table-cell">{o.items.length}</td>
                        <td className="text-end font-medium tabular-nums text-foreground">{formatPrice(total)}</td>
                        <td>
                          <span className={paymentBadge(o)}>{t(paymentLabelKey(o))}</span>
                        </td>
                        <td>
                          {awaitingCall ? (
                            <div className="space-y-1">
                              <button onClick={() => setCalling(o.id)} className="btn-primary btn-sm whitespace-nowrap">
                                <PhoneCall className="h-3.5 w-3.5" />
                                {t("dash.calls.button")}
                              </button>
                              {(o.callAttempts ?? 0) > 0 && (
                                <span className="block text-[11px] text-muted-foreground">
                                  {t("dash.calls.unanswered", { count: o.callAttempts ?? 0 })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <select
                                value={shown}
                                onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                                aria-label={t("dash.orders.statusFor", { id: o.id.slice(0, 8) })}
                                className={cn(
                                  "cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1",
                                  "text-xs font-semibold transition-opacity hover:opacity-80",
                                  "focus:outline-none focus:ring-2 focus:ring-ring/60",
                                  orderStatusBadge[shown],
                                )}
                              >
                                {statuses.map((s) => (
                                  <option key={s} value={s}>
                                    {t(`status.${s}`)}
                                  </option>
                                ))}
                              </select>
                              {myShipment?.trackingNumber && (
                                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                                  {myShipment.trackingNumber}
                                </span>
                              )}
                              {o.status === "cancelled" && o.cancelledBy === "customer" && (
                                <span className="mt-1 block text-[11px] text-muted-foreground">{t("dash.orders.cancelledByCustomer")}</span>
                              )}
                              {o.status === "returned" && o.returnReason && (
                                <span className="mt-1 block text-[11px] text-muted-foreground">{o.returnReason}</span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        icon={ClipboardList}
                        title={t("dash.orders.emptyTitle")}
                        description={t("dash.orders.emptyBody")}
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

      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
      )}

      {calling && <CallModal orderId={calling} onClose={() => setCalling(null)} />}
    </div>
  );
}
