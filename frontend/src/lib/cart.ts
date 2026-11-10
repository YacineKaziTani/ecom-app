import { Product, ProductVariant } from "../api/types";

export interface CartLine {
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
}

// A cart line is a product plus, when it has options, the chosen one.
export const lineKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;
export const keyOf = (line: Pick<CartLine, "product" | "variant">) => lineKey(line.product.id, line.variant?.id);
export function parseLineKey(key: string): { productId: string; variantId: string | null } {
  const [productId, variantId] = key.split(":");
  return { productId, variantId: variantId || null };
}

// An option's own price, or the product's.
export const unitPrice = (product: Product, variant?: ProductVariant | null) =>
  Number(variant?.price != null ? variant.price : product.price);
export const linePrice = (line: CartLine) => unitPrice(line.product, line.variant);

// "Robe kabyle — M"
export const itemLabel = (name: string, variantName?: string | null) =>
  variantName ? `${name} — ${variantName}` : name;
