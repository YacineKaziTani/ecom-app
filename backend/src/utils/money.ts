// Chargily only charges in Algerian dinars, so every displayed amount is DZD.
const dzd = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
});

// Whole amounts without centimes ("3 500 DA"), like the storefront.
const dzdWhole = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
  maximumFractionDigits: 0,
});

export function formatDzd(value: number | string): string {
  const amount = Number(value);
  return (Number.isInteger(amount) ? dzdWhole : dzd).format(amount);
}
