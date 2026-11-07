import { useParams, Link } from "react-router";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
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
import { WishlistButton } from "../components/WishlistButton";
import { StarRating } from "../components/StarRating";
import { ReviewsSection } from "../components/ReviewsSection";

// Only promises the platform actually keeps.
const guarantees: { icon: typeof Store; label: MessageKey; hint: MessageKey }[] = [
  { icon: Store, label: "guarantee.makers", hint: "guarantee.makersHint" },
  { icon: ShieldCheck, label: "guarantee.payment", hint: "guarantee.paymentHint" },
  { icon: PackageSearch, label: "guarantee.tracking", hint: "guarantee.trackingHint" },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const { addItem } = useCart();
  const { t, tp } = useI18n();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  useDocumentMeta(
    product?.name,
    product?.description,
    product && {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      image: [product.imageUrl, ...(product.galleryUrls ?? [])].filter(Boolean),
      ...(product.shop ? { brand: { "@type": "Brand", name: product.shop.name } } : {}),
      offers: {
        "@type": "Offer",
        price: Number(product.price).toFixed(2),
        priceCurrency: "DZD",
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
      ...((product.ratingCount ?? 0) > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(product.ratingAverage).toFixed(1),
              reviewCount: product.ratingCount,
            },
          }
        : {}),
    },
  );

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
          title={t("product.notFoundTitle")}
          description={t("product.notFoundBody")}
          action={
            <Link to="/" className="btn-primary">
              {t("common.backToShop")}
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
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t("common.backToShop")}
      </Link>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Gallery ---------------------------------------------- */}
        <div className="animate-fade-in">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted p-8 shadow-sm">
            {product.imageUrl ? (
              <img
                src={optimizedImage(activeImage ?? product.imageUrl, 1200)}
                alt={product.name}
                className="h-full w-full object-contain drop-shadow-lg transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-9 w-9" />
                <span className="text-sm">{t("product.noImage")}</span>
              </div>
            )}

            {soldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                <span className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
                  {t("product.soldOut")}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails: the main photo plus the gallery */}
          {product.imageUrl && (product.galleryUrls?.length ?? 0) > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[product.imageUrl, ...(product.galleryUrls ?? [])].map((url) => {
                const active = (activeImage ?? product.imageUrl) === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(url)}
                    aria-label={t("product.showPhoto")}
                    aria-pressed={active}
                    className={cn(
                      "h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-secondary transition-colors",
                      active ? "border-accent" : "border-transparent hover:border-border",
                    )}
                  >
                    <img src={optimizedImage(url, 128)} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {guarantees.map(({ icon: Icon, label, hint }) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card px-3 py-3 text-center"
              >
                <Icon className="mx-auto h-4 w-4 text-accent" />
                <p className="mt-1.5 text-xs font-semibold text-foreground">
                  {t(label)}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {t(hint)}
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

          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              {product.name}
            </h1>
            <WishlistButton productId={product.id} className="flex-shrink-0 border border-border" />
          </div>
          {(product.ratingCount ?? 0) > 0 && (
            <div className="mt-2">
              <StarRating value={Number(product.ratingAverage)} count={product.ratingCount} size="md" />
            </div>
          )}

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
                ? t("product.outOfStock")
                : product.stock <= 5
                  ? t("product.onlyLeftInStock", { count: product.stock })
                  : t("product.inStock", { count: product.stock })}
            </span>
          </div>

          <div className="my-7 divider" />

          <div className="prose-sm">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("product.description")}
            </h2>
            <p className="mt-2.5 leading-relaxed text-muted-foreground">
              {product.description ||
                t("product.noDescription")}
            </p>
          </div>

          {/* Buy box */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-1 sm:justify-start">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="icon-btn h-9 w-9"
                aria-label={t("product.decrease")}
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
                aria-label={t("product.increase")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                addItem(product, qty);
                toast.success(t("product.added", { name: product.name }));
              }}
              disabled={soldOut}
              className="btn-primary btn-lg flex-1"
            >
              <ShoppingBag className="h-4 w-4" />
              {soldOut ? t("product.outOfStock") : t("product.addToCart")}
            </button>
          </div>

          {!soldOut && (
            <p className="mt-3 text-center text-xs text-muted-foreground sm:text-start">
              {tp("product.subtotalFor", qty)}{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(Number(product.price) * qty)}
              </span>
            </p>
          )}
        </div>
      </div>

      <ReviewsSection productId={product.id} />
    </div>
  );
}
