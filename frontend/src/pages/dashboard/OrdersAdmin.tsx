import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ClipboardList, Info } from "lucide-react";
import { ordersApi } from "../../api/orders";
import { OrderStatus } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import {
  orderStatusBadge,
  paymentStatusBadge,
  formatPrice,
  formatDate,
} from "../../lib/status";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/Pagination";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const statuses: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export default function OrdersAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "admin", { page, status: statusFilter }],
    queryFn: () =>
      ordersApi.list({ page, limit: 20, status: statusFilter || undefined }),
    placeholderData: keepPreviousData,
  });
  const orders = data?.items;

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] }); // stock may have changed — see cancellation handling below
      if (variables.status === "cancelled") {
        toast.success("Order cancelled — stock has been restored");
      } else {
        toast.success("Order status updated");
      }
    },
    onError: (err: any) => {
      const issues = err?.data?.issues;
      if (issues?.length) {
        const names = issues
          .map((i: any) => i.productName || "an item")
          .join(", ");
        toast.error(`Can't reactivate — not enough stock left for: ${names}`, {
          duration: 6000,
        });
      } else {
        toast.error(String(err));
      }
    },
  });

  function handleStatusChange(
    order: { id: string; status: OrderStatus },
    newStatus: OrderStatus,
  ) {
    if (
      newStatus === "cancelled" &&
      !confirm(
        "Cancel this order? Its reserved stock will be added back to inventory.",
      )
    ) {
      return;
    }
    if (order.status === "cancelled" && newStatus !== "cancelled") {
      if (
        !confirm(
          "Reactivate this order? Its stock will be re-reserved if still available.",
        )
      )
        return;
    }
    updateMutation.mutate({ id: order.id, status: newStatus });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Track incoming orders and move them through fulfilment."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            aria-label="Filter by status"
            className="select capitalize"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      />

      {!isSuperAdmin && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Showing orders that include at least one item from your shop. Totals
          and item counts reflect your items only.
        </p>
      )}

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total</th>
                <th>Payment</th>
                <th>Status</th>
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
                      : o.items.reduce(
                          (s, i) => s + Number(i.price) * i.quantity,
                          0,
                        );
                    return (
                      <tr key={o.id}>
                        <td className="font-mono text-xs font-semibold text-accent">
                          #{o.id.slice(0, 8)}
                        </td>
                        <td className="text-foreground">
                          {o.user ? (
                            `${o.user.firstName} ${o.user.lastName}`
                          ) : o.guestEmail ? (
                            <span>
                              {o.guestEmail}
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                (guest)
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          {formatDate(o.createdAt)}
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {o.items.length}
                        </td>
                        <td className="text-right font-medium tabular-nums text-foreground">
                          {formatPrice(total)}
                        </td>
                        <td>
                          <span className={paymentStatusBadge[o.paymentStatus]}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <select
                            value={o.status}
                            onChange={(e) =>
                              handleStatusChange(
                                o,
                                e.target.value as OrderStatus,
                              )
                            }
                            aria-label={`Status for order ${o.id.slice(0, 8)}`}
                            className={cn(
                              "cursor-pointer appearance-none rounded-full border-0 py-1 pl-2.5 pr-2.5",
                              "text-xs font-semibold capitalize transition-opacity hover:opacity-80",
                              "focus:outline-none focus:ring-2 focus:ring-ring/60",
                              orderStatusBadge[o.status],
                            )}
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        icon={ClipboardList}
                        title="No orders yet"
                        description="Orders will appear here as soon as customers start buying."
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
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
