import { Link } from "react-router";
import { Plus, ImageOff } from "lucide-react";
import { Product } from "../api/types";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/status";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const soldOut = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  return (
    <article className="card-interactive group flex flex-col overflow-hidden">
      <Link
        to={`/products/${product.id}`}
        className="relative block aspect-square w-full overflow-hidden bg-secondary"
      >
        {product.imageUrl ? (
          <img
            src={optimizedImage(product.imageUrl, 600)}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-7 w-7" />
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Warm vignette that deepens on hover, giving the image some presence. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background">
              Sold out
            </span>
          </div>
        )}

        {lowStock && (
          <span className="badge-warning absolute left-3 top-3 shadow-sm">
            Only {product.stock} left
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

        {product.shop && (
          <Link
            to={`/shops/${product.shop.slug}`}
            className="mt-1 block truncate text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            by {product.shop.name}
          </Link>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <span className="font-serif text-xl font-bold leading-none text-foreground">
            {formatPrice(product.price)}
          </span>

          <button
            onClick={() => {
              addItem(product, 1);
              toast.success(`${product.name} added to cart`);
            }}
            disabled={soldOut}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary
                       text-primary-foreground shadow-xs transition-all duration-200
                       hover:scale-110 hover:shadow-md active:scale-95
                       disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label={`Add ${product.name} to cart`}
            title="Add to cart"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </article>
  );
}
