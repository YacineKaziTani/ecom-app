import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { ordersApi } from "../api/orders";
import { Order, OrderStatus } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import toast from "react-hot-toast";

const OPEN: OrderStatus[] = ["pending", "processing"];

// Same rule as the server: nothing shipped yet, by any shop.
const notShipped = (order: Order) =>
  OPEN.includes(order.status) && (order.shipments ?? []).every((s) => OPEN.includes(s.status));

// Lets a customer cancel their own order before it ships. Orders already paid
// online need a refund, so those get a "contact us" note instead.
export function CancelOrder({
  order,
  email,
  onCancelled,
}: {
  order: Order;
  email?: string; // guests prove the order is theirs with their checkout email
  onCancelled?: (order: Order) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(order.id, email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      toast.success(t("order.cancelledToast"));
      onCancelled?.({
        ...order,
        status: "cancelled",
        cancelledBy: "customer",
        shipments: order.shipments?.map((s) => ({ ...s, status: "cancelled" })),
      });
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!notShipped(order)) return null;
  if (order.paymentMethod === "card" && order.paymentStatus === "paid") {
    return <p className="text-xs text-muted-foreground">{t("order.cancelContact")}</p>;
  }
  return (
    <button
      type="button"
      onClick={() => confirm(t("order.cancelConfirm")) && cancel.mutate()}
      disabled={cancel.isPending}
      className="btn-ghost btn-sm text-destructive"
    >
      <XCircle className="h-4 w-4" />
      {t("order.cancel")}
    </button>
  );
}
