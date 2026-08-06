import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "../../api/orders";
import { OrderStatus, PaymentStatus } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import toast from "react-hot-toast";

const statuses: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  unpaid: "bg-gray-100 text-gray-600",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function OrdersAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

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
    <div className="p-8">
      <h1 className="mb-2 font-serif text-2xl font-bold text-foreground">
        Orders
      </h1>
      {!isSuperAdmin && (
        <p className="mb-6 text-sm text-muted-foreground">
          Showing orders that include at least one item from your shop. Totals
          and item counts reflect your items only.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
            ) : orders?.length ? (
              orders.map((o) => {
                const total = isSuperAdmin
                  ? Number(o.total)
                  : o.items.reduce(
                      (s, i) => s + Number(i.price) * i.quantity,
                      0,
                    );
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {o.user
                        ? `${o.user.firstName} ${o.user.lastName}`
                        : o.guestEmail
                          ? `${o.guestEmail} (guest)`
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.items.length} item(s)
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ${total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${paymentStatusColors[o.paymentStatus]}`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          handleStatusChange(o, e.target.value as OrderStatus)
                        }
                        className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-accent ${statusColors[o.status]}`}
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
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
