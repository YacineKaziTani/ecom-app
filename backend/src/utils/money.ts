// Chargily only charges in Algerian dinars, so every displayed amount is DZD.
const dzd = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
});

export function formatDzd(value: number | string): string {
  return dzd.format(Number(value));
}
