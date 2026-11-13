import { useParams, Link } from "react-router";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  ShieldCheck,
  PackageSearch,
  ImageOff,
  Maximize2,
} from "lucide-react";
import { productsApi } from "../api/products";
import { Product } from "../api/types";
import { unitPrice } from "../lib/cart";
import { recentlyViewed, rememberViewed } from "../lib/recentlyViewed";
import { ProductCard } from "../components/ProductCard";
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
import { ProductPlaceholder } from "../components/ProductPlaceholder";
import { ImageLightbox } from "../components/ImageLightbox";
import { DeliveryEstimate } from "../components/DeliveryEstimate";
import { StockAlertForm } from "../components/StockAlertForm";
import { saleInfo } from "../lib/pricing";
import { pixels } from "../lib/pixels";

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
  const [variantId, setVariantId] = useState<string | null>(null);
  const { addItem } = useCart();
  const { t, tp } = useI18n();
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Hover zoom on large screens: where the pointer is, in % of the photo.
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null);
  // Phones: a buy bar appears while the main "Add to cart" is off screen.
  const buyBoxRef = useRef<HTMLDivElement>(null);
  const [buyBoxInView, setBuyBoxInView] = useState(true);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  // What was viewed before this page (so it isn't listed on its own page).
  const [previouslyViewed, setPreviouslyViewed] = useState<string[]>([]);
  useEffect(() => {
    setQty(1);
    setVariantId(null);
    setActiveImage(null);
    setLightbox(null);
    setPreviouslyViewed(recentlyViewed().filter((x) => x !== id));
  }, [id]);
  useEffect(() => {
    if (!product) return;
    rememberViewed(product.id);
    pixels.viewContent({ id: product.id, name: product.name, price: Number(product.price) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);
  useEffect(() => {
    const el = buyBoxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setBuyBoxInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [product?.id]);

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

  const variants = product.variants ?? [];
  const hasOptions = variants.length > 0;
  // A lone option is picked for the customer.
  const variant =
    variants.find((v) => v.id === variantId) ?? (variants.length === 1 ? variants[0] : null);
  const needsChoice = hasOptions && !variant;
  const price = unitPrice(product, variant);
  const stock = variant ? variant.stock : product.stock;
  const soldOut = product.stock === 0 || (variant !== null && variant.stock === 0);
  const sale = saleInfo(product, price);

  const photos = product.imageUrl ? [product.imageUrl, ...(product.galleryUrls ?? [])] : [];
  const shownPhoto = activeImage ?? product.imageUrl;
  const canHoverZoom = () => window.matchMedia("(hover: hover) and (min-width: 1024px)").matches;

  function addToCart() {
    // Keep the cart snapshot small: the option list isn't needed there.
    const { variants: _options, ...base } = product!;
    addItem(base as Product, qty, variant);
    toast.success(t("product.added", { name: variant ? `${product!.name} — ${variant.name}` : product!.name }));
  }

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
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted shadow-sm",
              product.imageUrl && "p-8",
            )}
          >
            {shownPhoto ? (
              <button
                type="button"
                onClick={() => setLightbox(Math.max(0, photos.indexOf(shownPhoto)))}
                onMouseMove={(e) => {
                  if (!canHoverZoom()) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoomAt({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }}
                onMouseLeave={() => setZoomAt(null)}
                aria-label={t("product.enlarge")}
                className="group/photo block h-full w-full cursor-zoom-in"
              >
                <img
                  src={optimizedImage(shownPhoto, 1200)}
                  alt={product.name}
                  style={zoomAt ? { transform: "scale(1.8)", transformOrigin: `${zoomAt.x}% ${zoomAt.y}%` } : undefined}
                  className="h-full w-full object-contain drop-shadow-lg transition-transform duration-300 ease-out"
                />
                <span className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm transition-opacity group-hover/photo:opacity-0">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <ProductPlaceholder name={product.name} size="lg" />
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
                         bg-card py-1.5 ps-1.5 pe-3.5 text-sm transition-colors hover:border-accent/50"
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
                {t("product.by", { shop: product.shop.name })}
              </span>
            </Link>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className={cn("font-serif text-4xl font-bold", sale ? "text-destructive" : "text-foreground")}>
              {formatPrice(price)}
            </p>
            {sale && (
              <>
                <p className="pb-1 text-lg text-muted-foreground line-through">{formatPrice(sale.before)}</p>
                <span className="mb-1.5 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold leading-none text-white">
                  −{sale.percent}%
                </span>
              </>
            )}
          </div>
          {sale && (
            <p className="mt-1 text-sm font-medium text-destructive">{t("product.youSave", { amount: formatPrice(sale.saving) })}</p>
          )}

          {hasOptions && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold text-foreground">
                {variant ? t("product.option", { name: variant.name }) : t("product.chooseOption")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const selected = variant?.id === v.id;
                  const out = v.stock === 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariantId(v.id);
                        setQty(1);
                      }}
                      aria-pressed={selected}
                      className={cn(
                        "min-w-12 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-accent/60",
                        out && !selected && "text-muted-foreground line-through opacity-60",
                      )}
                      title={out ? t("product.soldOut") : undefined}
                    >
                      {v.name}
                      {v.price != null && Number(v.price) !== Number(product.price) && (
                        <span className={cn("ms-1.5 text-xs", selected ? "opacity-80" : "text-muted-foreground")}>
                          {formatPrice(Number(v.price))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                soldOut
                  ? "bg-destructive"
                  : stock <= 5
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
                : needsChoice
                  ? t("product.inStockOptions")
                  : stock <= 5
                    ? t("product.onlyLeftInStock", { count: stock })
                    : t("product.inStock", { count: stock })}
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

          {/* Buy box (or, sold out: "tell me when it's back") */}
          {soldOut && <StockAlertForm productId={product.id} variantId={variant?.id ?? null} />}
          <div ref={buyBoxRef} className={cn("mt-8 flex flex-col gap-3 sm:flex-row sm:items-center", soldOut && "hidden")}>
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
                onClick={() => setQty((q) => Math.min(stock, q + 1))}
                disabled={qty >= stock}
                className="icon-btn h-9 w-9"
                aria-label={t("product.increase")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={addToCart}
              disabled={soldOut || needsChoice}
              className="btn-primary btn-lg flex-1"
            >
              <ShoppingBag className="h-4 w-4" />
              {soldOut
                ? t("product.outOfStock")
                : needsChoice
                  ? t("product.chooseOption")
                  : t("product.addToCart")}
            </button>
          </div>

          {!soldOut && (
            <p className="mt-3 text-center text-xs text-muted-foreground sm:text-start">
              {tp("product.subtotalFor", qty)}{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(price * qty)}
              </span>
            </p>
          )}

          <DeliveryEstimate />
        </div>
      </div>

      {lightbox !== null && photos.length > 0 && (
        <ImageLightbox images={photos} index={lightbox} alt={product.name} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}

      {/* Phones: the buy bar while the main button is off screen. */}
      {!buyBoxInView && !soldOut && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur animate-fade-up lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
              <p className="font-serif text-lg font-bold leading-tight text-foreground">{formatPrice(price)}</p>
            </div>
            <button
              type="button"
              onClick={() => (needsChoice ? buyBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : addToCart())}
              className="btn-primary flex-shrink-0"
            >
              <ShoppingBag className="h-4 w-4" />
              {needsChoice ? t("product.chooseOption") : t("product.addToCart")}
            </button>
          </div>
        </div>
      )}

      <ReviewsSection productId={product.id} />
      <RelatedProducts productId={product.id} />
      <RecentlyViewed ids={previouslyViewed} />
      {/* Room for the phone buy bar at the very bottom. */}
      <div className="h-20 lg:hidden" aria-hidden />
    </div>
  );
}

function ProductRow({ title, products }: { title: string; products: Product[] }) {
  return (
    <section className="mt-16">
      <h2 className="mb-5 text-2xl font-bold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function RelatedProducts({ productId }: { productId: string }) {
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ["product", productId, "related"],
    queryFn: () => productsApi.related(productId),
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.length) return null;
  return <ProductRow title={t("product.related")} products={data.slice(0, 4)} />;
}

function RecentlyViewed({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  const shown = ids.slice(0, 4);
  const { data } = useQuery({
    queryKey: ["products", "recently-viewed", shown],
    queryFn: () => productsApi.list({ ids: shown.join(","), limit: shown.length }),
    enabled: shown.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.items.length) return null;
  // Keep the order they were viewed in.
  const byId = new Map(data.items.map((p) => [p.id, p]));
  const products = shown.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  return <ProductRow title={t("product.recentlyViewed")} products={products} />;
}
