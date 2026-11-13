import type { Product } from "../api/types";

// A running promotion: the crossed-out price is above what's charged.
export function saleInfo(product: Pick<Product, "compareAtPrice">, price: number) {
  const before = Number(product.compareAtPrice);
  if (!before || before <= price) return null;
  return { before, saving: before - price, percent: Math.round(((before - price) / before) * 100) };
}
