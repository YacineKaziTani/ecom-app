import { CustomerRisk } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { riskBadge } from "../lib/status";

const counts = (r: CustomerRisk) => ({
  orders: r.orders,
  delivered: r.delivered,
  returned: r.returned,
  refused: r.refused,
});

// A customer's delivery track record, shown next to their pay-on-delivery
// orders. Hidden for first-time customers (nothing to go on yet).
export function RiskBadge({ risk }: { risk?: CustomerRisk | null }) {
  const { t } = useI18n();
  if (!risk || (risk.level === "low" && risk.orders <= 1)) return null;
  return (
    <span className={riskBadge[risk.level]} title={t("dash.risk.history", counts(risk))}>
      {t(`dash.risk.${risk.level}`)}
    </span>
  );
}

export function RiskHistory({ risk }: { risk?: CustomerRisk | null }) {
  const { t } = useI18n();
  if (!risk) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {t("dash.risk.history", counts(risk))}
    </p>
  );
}
