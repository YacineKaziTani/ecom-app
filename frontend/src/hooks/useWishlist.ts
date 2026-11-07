import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../i18n/I18nProvider";
import { useNavigate } from "react-router";
import { wishlistApi } from "../api/wishlist";
import { useAuth } from "../store/AuthContext";
import toast from "react-hot-toast";

// Saved products for the signed-in customer; guests are sent to sign in.
export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();

  const { data } = useQuery({
    queryKey: ["wishlist"],
    queryFn: wishlistApi.list,
    enabled: !!user,
    staleTime: 60_000,
  });
  const ids = new Set(data?.map((i) => i.productId));

  const mutation = useMutation({
    mutationFn: ({ productId, save }: { productId: string; save: boolean }) =>
      save ? wishlistApi.add(productId) : wishlistApi.remove(productId),
    onSuccess: (_d, { save }) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(save ? t("wishlist.saved") : t("wishlist.removed"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  return {
    items: data ?? [],
    isSaved: (productId: string) => ids.has(productId),
    toggle: (productId: string) => {
      if (!user) {
        navigate("/login");
        return;
      }
      mutation.mutate({ productId, save: !ids.has(productId) });
    },
  };
}
