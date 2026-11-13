import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../store/AuthContext";
import { useCartStore } from "../store/cartStore";
import { cartApi, CartResponse } from "../api/cart";
import { Product, ProductVariant } from "../api/types";
import { CartLine, linePrice, parseLineKey, unitPrice } from "../lib/cart";
import { pixels } from "../lib/pixels";

// Presents one interface over two backends: a server-persisted cart for
// logged-in users, and the localStorage-backed zustand store for guests.
// This is what keeps a cart from leaking between accounts on a shared
// browser — a guest's cart lives only in their own browser until it's
// explicitly merged into their account on login.
//
// Lines are addressed by their key (lib/cart.ts lineKey: product + option).
export function useCart() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const guest = useCartStore();

  const serverCart = useQuery({
    queryKey: ["cart"],
    queryFn: cartApi.get,
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const setCart = (data: CartResponse) => qc.setQueryData(["cart"], data);

  const addMutation = useMutation({
    mutationFn: (v: { productId: string; quantity: number; variantId?: string | null }) =>
      cartApi.addItem(v.productId, v.quantity, v.variantId),
    onSuccess: setCart,
  });

  const setQuantityMutation = useMutation({
    mutationFn: (v: { key: string; quantity: number }) => cartApi.setQuantity(parseLineKey(v.key), v.quantity),
    onSuccess: setCart,
  });

  const removeMutation = useMutation({
    mutationFn: (key: string) => cartApi.removeItem(parseLineKey(key)),
    onSuccess: setCart,
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: setCart,
  });

  const tracked = (product: Product, quantity: number, variant: ProductVariant | null) =>
    pixels.addToCart({ id: product.id, name: product.name, price: unitPrice(product, variant), quantity });

  if (user) {
    const lines: CartLine[] = (serverCart.data?.lines ?? []).map((l) => ({
      product: l.product,
      variant: l.variant,
      quantity: l.quantity,
    }));
    return {
      lines,
      isLoading: serverCart.isLoading,
      addItem: (product: Product, quantity = 1, variant: ProductVariant | null = null) => {
        tracked(product, quantity, variant);
        addMutation.mutate({ productId: product.id, quantity, variantId: variant?.id });
      },
      removeItem: (key: string) => removeMutation.mutate(key),
      setQuantity: (key: string, quantity: number) => setQuantityMutation.mutate({ key, quantity }),
      clear: () => clearMutation.mutate(),
      total: () => lines.reduce((sum, l) => sum + linePrice(l) * l.quantity, 0),
      count: () => lines.reduce((sum, l) => sum + l.quantity, 0),
    };
  }

  return {
    lines: guest.lines,
    isLoading: false,
    addItem: (product: Product, quantity = 1, variant: ProductVariant | null = null) => {
      tracked(product, quantity, variant);
      guest.addItem(product, quantity, variant);
    },
    removeItem: guest.removeItem,
    setQuantity: guest.setQuantity,
    clear: guest.clear,
    total: guest.total,
    count: guest.count,
  };
}

// Called right after a successful login/register: folds whatever the guest
// had in their localStorage cart into their server-side cart, then wipes
// the local copy so it can't leak into the next guest session on this
// browser.
export async function mergeGuestCartIntoAccount(
  qc: ReturnType<typeof useQueryClient>,
) {
  const guestLines = useCartStore.getState().lines;
  if (guestLines.length > 0) {
    try {
      await cartApi.merge(
        guestLines.map((l) => ({
          productId: l.product.id,
          variantId: l.variant?.id ?? null,
          quantity: l.quantity,
        })),
      );
    } catch (err) {
      // Best effort: a failed merge must not turn a successful sign-in into an error.
      console.error("Could not merge guest cart into account", err);
    }
  }
  useCartStore.getState().clear();
  await qc.invalidateQueries({ queryKey: ["cart"] });
}
