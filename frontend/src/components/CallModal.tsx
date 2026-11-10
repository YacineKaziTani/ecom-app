import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Phone, PhoneOff, ThumbsDown, CheckCircle2, UserX } from "lucide-react";
import { ordersApi } from "../api/orders";
import { blockedPhonesApi } from "../api/blockedPhones";
import { CallOutcome } from "../api/types";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { formatPrice } from "../lib/status";
import { Modal } from "./ui/Modal";
import { RiskBadge, RiskHistory } from "./RiskBadge";
import toast from "react-hot-toast";

const OUTCOMES: { outcome: CallOutcome; icon: typeof Phone; className: string }[] = [
  { outcome: "confirmed", icon: CheckCircle2, className: "btn-primary" },
  { outcome: "no_answer", icon: PhoneOff, className: "btn-outline" },
  { outcome: "declined", icon: ThumbsDown, className: "btn-outline text-destructive" },
  { outcome: "wrong_number", icon: UserX, className: "btn-outline text-destructive" },
];

// Phone confirmation of a pay-on-delivery order: call, record what happened.
// Confirmed → processing; no answer → retry later; declined / wrong number →
// cancelled and restocked.
export function CallModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: order, refetch } = useQuery({
    queryKey: ["order", orderId, "staff"],
    queryFn: () => ordersApi.get(orderId),
  });

  const log = useMutation({
    mutationFn: (outcome: CallOutcome) => ordersApi.logCall(orderId, outcome, note || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("dash.calls.logged"));
      setNote("");
      if (res.order.status !== "pending") onClose();
      else refetch();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const block = useMutation({
    mutationFn: (reason: string) => blockedPhonesApi.block(order!.phone!, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      refetch();
      toast.success(t("dash.calls.blocked"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  return (
    <Modal open onClose={onClose} title={t("dash.calls.title", { id: orderId.slice(0, 8) })} description={t("dash.calls.description")}>
      {!order ? null : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">
                {order.user ? `${order.user.firstName} ${order.user.lastName}` : order.guestName || order.guestEmail}
              </p>
              <p className="text-sm text-muted-foreground">
                {[order.wilayaName, order.commune].filter(Boolean).join(", ")} · {formatPrice(order.total)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RiskBadge risk={order.customerRisk} />
                <RiskHistory risk={order.customerRisk} />
              </div>
            </div>
            {order.phone && (
              <a href={`tel:${order.phone}`} className="btn-primary">
                <Phone className="h-4 w-4" />
                {t("dash.calls.callNow", { phone: order.phone })}
              </a>
            )}
          </div>

          <div>
            <p className="label">{t("dash.calls.whatHappened")}</p>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(({ outcome, icon: Icon, className }) => (
                <button
                  key={outcome}
                  type="button"
                  disabled={log.isPending || order.status !== "pending"}
                  onClick={() => log.mutate(outcome)}
                  className={className}
                >
                  <Icon className="h-4 w-4" />
                  {t(`dash.outcome.${outcome}`)}
                </button>
              ))}
            </div>
            <label htmlFor="call-note" className="label mt-3">{t("dash.calls.note")}</label>
            <input
              id="call-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              className="input"
              placeholder={t("dash.calls.notePlaceholder")}
            />
          </div>

          <div>
            <p className="label">{t("dash.calls.history")}</p>
            {order.calls?.length ? (
              <ul className="space-y-1.5 text-sm">
                {order.calls.map((c) => (
                  <li key={c.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{t(`dash.outcome.${c.outcome}`)}</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    {c.note && <span>— {c.note}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dash.calls.none")}</p>
            )}
          </div>

          {isSuperAdmin && order.phone && !order.customerRisk?.blocked && (
            <button
              type="button"
              onClick={() => {
                const reason = prompt(t("dash.calls.blockPrompt"));
                if (reason !== null) block.mutate(reason);
              }}
              disabled={block.isPending}
              className="btn-ghost text-destructive"
            >
              <Ban className="h-4 w-4" />
              {t("dash.calls.block")}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
