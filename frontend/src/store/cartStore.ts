import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, ProductVariant } from "../api/types";
import { CartLine, keyOf, lineKey, linePrice } from "../lib/cart";

export type { CartLine };

interface CartState {
  lines: CartLine[];
  addItem: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

// The guest cart (localStorage). Lines are addressed by lineKey(product, option).
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addItem: (product, quantity = 1, variant = null) =>
        set((state) => {
          const key = lineKey(product.id, variant?.id);
          const existing = state.lines.find((l) => keyOf(l) === key);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                keyOf(l) === key ? { ...l, quantity: l.quantity + quantity } : l,
              ),
            };
          }
          return { lines: [...state.lines, { product, variant, quantity }] };
        }),
      removeItem: (key) => set((state) => ({ lines: state.lines.filter((l) => keyOf(l) !== key) })),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) => (keyOf(l) === key ? { ...l, quantity } : l)),
        })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, l) => sum + linePrice(l) * l.quantity, 0),
      count: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    { name: "cart-storage" },
  ),
);
