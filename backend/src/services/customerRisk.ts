import { AppDataSource } from "../config/data-source";

export interface CustomerRisk {
  orders: number; // every order placed with this phone number
  delivered: number;
  returned: number; // parcels that came back
  refused: number; // declined / wrong number when called to confirm
  blocked: boolean;
  level: "low" | "medium" | "high" | "blocked";
}

// Delivery history per phone number, to spot likely refusals before shipping
// a pay-on-delivery parcel. Platform-wide on purpose: a number that refused
// parcels at one shop is a risk for every shop.
export async function riskByPhone(phones: (string | null | undefined)[]): Promise<Map<string, CustomerRisk>> {
  const unique = [...new Set(phones.filter(Boolean))] as string[];
  const result = new Map<string, CustomerRisk>();
  if (unique.length === 0) return result;

  const [history, blocked] = await Promise.all([
    AppDataSource.query(
      `SELECT o.phone,
              COUNT(*)::int AS orders,
              COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered,
              COUNT(*) FILTER (WHERE o.status = 'returned')::int AS returned,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM order_calls c
                WHERE c."orderId" = o.id AND c.outcome IN ('declined', 'wrong_number')
              ))::int AS refused
       FROM orders o
       WHERE o.phone = ANY($1)
       GROUP BY o.phone`,
      [unique],
    ),
    AppDataSource.query(`SELECT phone FROM blocked_phones WHERE phone = ANY($1)`, [unique]),
  ]);
  const blockedSet = new Set<string>(blocked.map((r: { phone: string }) => r.phone));

  for (const phone of unique) {
    const h = history.find((r: { phone: string }) => r.phone === phone) ?? { orders: 0, delivered: 0, returned: 0, refused: 0 };
    const bad = h.returned + h.refused;
    const isBlocked = blockedSet.has(phone);
    result.set(phone, {
      orders: h.orders,
      delivered: h.delivered,
      returned: h.returned,
      refused: h.refused,
      blocked: isBlocked,
      level: isBlocked ? "blocked" : bad >= 2 ? "high" : bad === 1 ? "medium" : "low",
    });
  }
  return result;
}

export async function isPhoneBlocked(phone: string): Promise<boolean> {
  const rows = await AppDataSource.query(`SELECT 1 FROM blocked_phones WHERE phone = $1`, [phone]);
  return rows.length > 0;
}
