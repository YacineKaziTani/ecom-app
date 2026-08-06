import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";
import { Product } from "../api/types";
import { useCartStore } from "../store/cartStore";
import toast from "react-hot-toast";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow duration-300 hover:shadow-md">
      <Link to={`/products/${product.id}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                Out of stock
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        {product.category && (
          <span className="text-xs font-medium uppercase tracking-wide text-accent">
            {product.category.name}
          </span>
        )}

        <Link to={`/products/${product.id}`}>
          <h3 className="mt-1 truncate font-semibold text-foreground transition-colors group-hover:text-accent">
            {product.name}
          </h3>
        </Link>

        {product.shop && (
          <Link
            to={`/shops/${product.shop.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block truncate text-xs text-muted-foreground transition-colors hover:text-accent hover:underline"
          >
            by {product.shop.name}
          </Link>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-serif text-lg font-bold text-foreground">
            ${Number(product.price).toFixed(2)}
          </span>
          <button
            onClick={() => {
              addItem(product, 1);
              toast.success(`${product.name} added to cart`);
            }}
            disabled={product.stock === 0}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
