import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  ShieldCheck,
  PackageSearch,
  ImageOff,
} from "lucide-react";
import { productsApi } from "../api/products";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/status";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";

// Only promises the platform actually keeps.
const guarantees = [
  { icon: Store, label: "Independent makers", hint: "Shipped by the shop" },
  { icon: ShieldCheck, label: "Secure payment", hint: "EDAHABIA & CIB" },
  { icon: PackageSearch, label: "Order tracking", hint: "Check status anytime" },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container-page py-10">
        <Skeleton className="mb-8 h-4 w-28" />
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={ImageOff}
          title="Product not found"
          description="This product may have been removed or is no longer available."
          action={
            <Link to="/" className="btn-primary">
              Back to shop
            </Link>
          }
        />
      </div>
    );
  }

  const soldOut = product.stock === 0;

  return (
    <div className="container-page py-8 sm:py-10">
      <Link
        to="/"
        className="mb-7 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Gallery ---------------------------------------------- */}
        <div className="animate-fade-in">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted p-8 shadow-sm">
            {product.imageUrl ? (
              <img
                src={optimizedImage(product.imageUrl, 1200)}
                alt={product.name}
                className="h-full w-full object-contain drop-shadow-lg transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-9 w-9" />
                <span className="text-sm">No image available</span>
              </div>
            )}

            {soldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                <span className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
                  Sold out
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {guarantees.map(({ icon: Icon, label, hint }) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card px-3 py-3 text-center"
              >
                <Icon className="mx-auto h-4 w-4 text-accent" />
                <p className="mt-1.5 text-xs font-semibold text-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {hint}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Details ---------------------------------------------- */}
        <div className="animate-fade-up lg:pt-2">
          {product.category && (
            <span className="eyebrow">{product.category.name}</span>
          )}

          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {product.name}
          </h1>

          {product.shop && (
            <Link
              to={`/shops/${product.shop.slug}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border
                         bg-card py-1.5 pl-1.5 pr-3.5 text-sm transition-colors hover:border-accent/50"
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-accent-soft">
                {product.shop.logoUrl ? (
                  <img
                    src={optimizedImage(product.shop.logoUrl, 64)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-3 w-3 text-accent" />
                )}
              </span>
              <span className="font-medium text-muted-foreground">
                by{" "}
                <span className="text-foreground">{product.shop.name}</span>
              </span>
            </Link>
          )}

          <p className="mt-6 font-serif text-4xl font-bold text-foreground">
            {formatPrice(product.price)}
          </p>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                soldOut
                  ? "bg-destructive"
                  : product.stock <= 5
                    ? "bg-warning"
                    : "bg-success",
              )}
            />
            <span
              className={cn(
                soldOut ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {soldOut
                ? "Out of stock"
                : product.stock <= 5
                  ? `Only ${product.stock} left in stock`
                  : `${product.stock} in stock`}
            </span>
          </div>

          <div className="my-7 divider" />

          <div className="prose-sm">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </h2>
            <p className="mt-2.5 leading-relaxed text-muted-foreground">
              {product.description ||
                "No description has been provided for this product yet."}
            </p>
          </div>

          {/* Buy box */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-1 sm:justify-start">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="icon-btn h-9 w-9"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span
                className="w-10 text-center text-sm font-semibold tabular-nums text-foreground"
                aria-live="polite"
              >
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
                className="icon-btn h-9 w-9"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                addItem(product, qty);
                toast.success(`${product.name} added to cart`);
              }}
              disabled={soldOut}
              className="btn-primary btn-lg flex-1"
            >
              <ShoppingBag className="h-4 w-4" />
              {soldOut ? "Out of stock" : "Add to cart"}
            </button>
          </div>

          {!soldOut && (
            <p className="mt-3 text-center text-xs text-muted-foreground sm:text-left">
              Subtotal for {qty} {qty === 1 ? "item" : "items"}:{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(Number(product.price) * qty)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
