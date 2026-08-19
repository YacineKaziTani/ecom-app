import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../store/AuthContext";
import { useCartStore } from "../store/cartStore";
import { cartApi, CartLine } from "../api/cart";
import { Product } from "../api/types";

// Presents one interface over two backends: a server-persisted cart for
// logged-in users, and the localStorage-backed zustand store for guests.
// This is what keeps a cart from leaking between accounts on a shared
// browser — a guest's cart lives only in their own browser until it's
// explicitly merged into their account on login.
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

  const invalidate = (data: { lines: CartLine[] }) =>
    qc.setQueryData(["cart"], data);

  const addMutation = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: string;
      quantity?: number;
    }) => cartApi.addItem(productId, quantity),
    onSuccess: invalidate,
  });

  const setQuantityMutation = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: string;
      quantity: number;
    }) => cartApi.setQuantity(productId, quantity),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => cartApi.removeItem(productId),
    onSuccess: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: invalidate,
  });

  if (user) {
    const lines = serverCart.data?.lines ?? [];
    return {
      lines: lines.map((l) => ({ product: l.product, quantity: l.quantity })),
      isLoading: serverCart.isLoading,
      addItem: (product: Product, quantity = 1) =>
        addMutation.mutate({ productId: product.id, quantity }),
      removeItem: (productId: string) => removeMutation.mutate(productId),
      setQuantity: (productId: string, quantity: number) =>
        setQuantityMutation.mutate({ productId, quantity }),
      clear: () => clearMutation.mutate(),
      total: () =>
        lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0),
      count: () => lines.reduce((sum, l) => sum + l.quantity, 0),
    };
  }

  return {
    lines: guest.lines,
    isLoading: false,
    addItem: guest.addItem,
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
    await cartApi.merge(
      guestLines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
    );
  }
  useCartStore.getState().clear();
  await qc.invalidateQueries({ queryKey: ["cart"] });
}
