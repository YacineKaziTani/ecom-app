import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { productsApi } from "../api/products";
import { useCartStore } from "../store/cartStore";
import toast from "react-hot-toast";
import { ArrowLeft, Minus, Plus } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="py-20 text-center">Loading...</div>;
  if (!product)
    return <div className="py-20 text-center">Product not found.</div>;

  return (
    <div>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted to-secondary p-8">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-contain drop-shadow-sm"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background">
                Out of stock
              </span>
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              {product.category.name}
            </span>
          )}
          <h1 className="mt-1.5 font-serif text-3xl font-bold text-foreground">
            {product.name}
          </h1>
          {product.shop && (
            <Link
              to={`/shops/${product.shop.slug}`}
              className="mt-1.5 inline-block text-sm text-muted-foreground transition-colors hover:text-accent hover:underline"
            >
              Sold by {product.shop.name}
            </Link>
          )}

          <p className="mt-4 font-serif text-3xl font-bold text-foreground">
            ${Number(product.price).toFixed(2)}
          </p>

          <p className="mt-4 leading-relaxed text-muted-foreground">
            {product.description || "No description available."}
          </p>

          <p className="mt-3 flex items-center gap-1.5 text-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                product.stock > 0 ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span
              className={
                product.stock > 0 ? "text-muted-foreground" : "text-red-500"
              }
            >
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </span>
          </p>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-lg border border-border">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="p-2.5 text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-foreground">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
                className="p-2.5 text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                addItem(product, qty);
                toast.success(`${product.name} added to cart`);
              }}
              disabled={product.stock === 0}
              className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
