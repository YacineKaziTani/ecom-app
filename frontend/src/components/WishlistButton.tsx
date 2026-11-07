import { Heart } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useWishlist } from "../hooks/useWishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { isSaved, toggle } = useWishlist();
  const { t } = useI18n();
  const saved = isSaved(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); // it sits inside product links
        toggle(productId);
      }}
      aria-pressed={saved}
      aria-label={saved ? t("wishlist.remove") : t("wishlist.save")}
      title={saved ? t("wishlist.remove") : t("wishlist.save")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-transform hover:scale-110",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", saved ? "fill-destructive text-destructive" : "text-muted-foreground")} />
    </button>
  );
}
