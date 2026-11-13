import { Link } from "react-router";
import { useI18n } from "../i18n/I18nProvider";
import { Plus, ChevronRight } from "lucide-react";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { Product } from "../api/types";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/status";
import { saleInfo } from "../lib/pricing";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";
import { WishlistButton } from "./WishlistButton";
import { StarRating } from "./StarRating";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t } = useI18n();
  const soldOut = product.stock === 0;
  // Products with options (size, colour...) are added from their own page.
  const hasOptions = (product.variantCount ?? product.variants?.length ?? 0) > 0;
  const lowStock = !hasOptions && product.stock > 0 && product.stock <= 5;
  const secondPhoto = product.galleryUrls?.[0];
  const sale = saleInfo(product, Number(product.price));
  const roundButton =
    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95";

  return (
    <article className="card-interactive group flex min-w-0 flex-col overflow-hidden">
      <Link
        to={`/products/${product.id}`}
        className="relative block aspect-square w-full overflow-hidden bg-secondary"
      >
        {product.imageUrl ? (
          <>
            <img
              src={optimizedImage(product.imageUrl, 600)}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />
            {/* The second photo fades in on hover (mouse only). */}
            {secondPhoto && (
              <img
                src={optimizedImage(secondPhoto, 600)}
                alt=""
                loading="lazy"
                className="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 [@media(hover:hover)]:block"
              />
            )}
          </>
        ) : (
          <ProductPlaceholder name={product.name} className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        )}

        {/* Warm vignette that deepens on hover, giving the image some presence. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background">
              {t("product.soldOut")}
            </span>
          </div>
        )}

        <WishlistButton productId={product.id} className="absolute end-3 top-3" />

        {(sale || lowStock) && (
          <span className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
            {sale && (
              <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold leading-none text-white shadow-sm">
                −{sale.percent}%
              </span>
            )}
            {lowStock && <span className="badge-warning shadow-sm">{t("product.onlyLeft", { count: product.stock })}</span>}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.category && (
          <span className="eyebrow text-[10px]">{product.category.name}</span>
        )}

        <h3 className="mt-1.5 line-clamp-2 font-sans text-sm font-semibold leading-snug text-foreground">
          <Link
            to={`/products/${product.id}`}
            className="transition-colors after:absolute hover:text-accent"
          >
            {product.name}
          </Link>
        </h3>

        {(product.ratingCount ?? 0) > 0 && (
          <div className="mt-1">
            <StarRating value={Number(product.ratingAverage)} count={product.ratingCount} />
          </div>
        )}

        {product.shop && (
          <Link
            to={`/shops/${product.shop.slug}`}
            className="mt-1 block truncate text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            {t("product.by", { shop: product.shop.name })}
          </Link>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <span className="min-w-0">
            {sale && (
              <span className="mb-1 block text-xs font-medium leading-none text-muted-foreground line-through">
                {formatPrice(sale.before)}
              </span>
            )}
            <span className={`block font-serif text-lg font-bold leading-none sm:text-xl ${sale ? "text-destructive" : "text-foreground"}`}>
              {formatPrice(product.price)}
            </span>
          </span>

          {hasOptions && !soldOut ? (
            <Link
              to={`/products/${product.id}`}
              className={roundButton}
              aria-label={t("product.chooseOptionsNamed", { name: product.name })}
              title={t("product.chooseOptions")}
            >
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.5} />
            </Link>
          ) : (
            <button
              onClick={() => {
                addItem(product, 1);
                toast.success(t("product.added", { name: product.name }));
              }}
              disabled={soldOut}
              className={`${roundButton} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100`}
              aria-label={t("product.addNamed", { name: product.name })}
              title={t("product.addToCart")}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
