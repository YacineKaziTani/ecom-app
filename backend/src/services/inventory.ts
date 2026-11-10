import { EntityManager, In } from "typeorm";
import { Product } from "../entities/Product";
import { ProductVariant } from "../entities/ProductVariant";
import { StockIssue } from "../utils/httpError";

// Stock lives in one of two places:
//   - a product without options keeps it in products.stock
//   - a product with options keeps it per option (product_variants.stock), and
//     products.stock is the sum of its options so listings, "in stock"
//     filters and search never need a join.
// Everything that changes stock goes through here so the two never drift.

export interface StockLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export const lineKey = (productId: string, variantId?: string | null) =>
  `${productId}:${variantId ?? ""}`;

// The same product + option listed twice must be checked as one line,
// otherwise each line passes the stock check on its own and stock goes negative.
export function mergeLines(lines: StockLine[]): StockLine[] {
  const merged = new Map<string, StockLine>();
  for (const { productId, variantId, quantity } of lines) {
    const key = lineKey(productId, variantId);
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { productId, variantId: variantId ?? null, quantity });
  }
  return [...merged.values()];
}

// When an option's (or a plain product's) stock drops to this or below at
// checkout, the shop owner gets an email. 0 turns alerts off except for
// selling out.
export function lowStockThreshold(): number {
  const raw = process.env.LOW_STOCK_THRESHOLD;
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isInteger(n) && n >= 0 ? n : 3;
}

export class LockedStock {
  private readonly byProduct = new Map<string, ProductVariant[]>();

  constructor(
    readonly products: Map<string, Product>,
    variants: ProductVariant[],
  ) {
    for (const v of variants) {
      const list = this.byProduct.get(v.productId) ?? [];
      list.push(v);
      this.byProduct.set(v.productId, list);
    }
  }

  variantsOf(productId: string): ProductVariant[] {
    return this.byProduct.get(productId) ?? [];
  }

  hasVariants(productId: string): boolean {
    return this.variantsOf(productId).length > 0;
  }

  variant(productId: string, variantId: string): ProductVariant | undefined {
    return this.variantsOf(productId).find((v) => v.id === variantId);
  }

  // The row holding this line's stock: the option, or the product itself when
  // it has none. undefined when it's gone, or when a product that now has
  // options is asked for without one.
  holder(productId: string, variantId?: string | null): Product | ProductVariant | undefined {
    if (variantId) return this.variant(productId, variantId);
    if (this.hasVariants(productId)) return undefined;
    return this.products.get(productId);
  }

  available(line: Pick<StockLine, "productId" | "variantId">): number {
    return this.holder(line.productId, line.variantId)?.stock ?? 0;
  }

  issue(line: StockLine, names: { productName?: string; variantName?: string | null } = {}): StockIssue {
    const variant = line.variantId ? this.variant(line.productId, line.variantId) : undefined;
    return {
      productId: line.productId,
      productName: names.productName ?? this.products.get(line.productId)?.name,
      variantId: line.variantId ?? null,
      variantName: names.variantName ?? variant?.name ?? null,
      availableStock: this.available(line),
      requestedQuantity: line.quantity,
    };
  }
}

// Row-locks (SELECT ... FOR UPDATE) the products, then all of their options,
// for the rest of the transaction, so two concurrent checkouts can't both
// pass the stock check and oversell. Products are locked first and in id
// order, and an option is only ever locked by a transaction already holding
// its product, so concurrent transactions can't deadlock each other.
export async function lockStock(manager: EntityManager, productIds: string[]): Promise<LockedStock> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new LockedStock(new Map(), []);
  const products = await manager.getRepository(Product).find({
    where: { id: In(ids) },
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  const variants = await manager.getRepository(ProductVariant).find({
    where: { productId: In(products.map((p) => p.id)) },
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  return new LockedStock(new Map(products.map((p) => [p.id, p])), variants);
}

export interface LowStockAlert {
  shopId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  stock: number;
}

// Applies stock deltas (negative = sold / reserved, positive = released) to
// rows locked by lockStock, then brings every touched product's total back in
// line with its options. Lines whose stock row no longer exists are skipped.
// Returns the rows that just fell to the low-stock threshold.
export async function applyStockChanges(
  manager: EntityManager,
  stock: LockedStock,
  changes: (Pick<StockLine, "productId" | "variantId"> & { delta: number })[],
): Promise<LowStockAlert[]> {
  const threshold = lowStockThreshold();
  const alerts: LowStockAlert[] = [];
  const touchedVariants = new Set<ProductVariant>();
  const touchedProducts = new Set<Product>();

  for (const change of changes) {
    const product = stock.products.get(change.productId);
    const holder = stock.holder(change.productId, change.variantId);
    if (!product || !holder || change.delta === 0) continue;

    const before = holder.stock;
    holder.stock += change.delta;
    if (holder instanceof ProductVariant) touchedVariants.add(holder);
    touchedProducts.add(product);

    if (change.delta < 0 && before > threshold && holder.stock <= threshold) {
      alerts.push({
        shopId: product.shopId,
        productId: product.id,
        productName: product.name,
        variantName: holder instanceof ProductVariant ? holder.name : null,
        stock: holder.stock,
      });
    }
  }

  for (const variant of touchedVariants) {
    await manager.getRepository(ProductVariant).update(variant.id, { stock: variant.stock });
  }
  for (const product of touchedProducts) {
    if (stock.hasVariants(product.id)) {
      product.stock = stock.variantsOf(product.id).reduce((sum, v) => sum + v.stock, 0);
    }
    await manager.getRepository(Product).update(product.id, { stock: product.stock });
  }
  return alerts;
}

// Price of one unit of a line: the option's own price, or the product's.
export function unitPrice(product: Product, variant?: ProductVariant | null): number {
  return variant?.price != null ? Number(variant.price) : Number(product.price);
}
