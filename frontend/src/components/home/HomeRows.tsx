import { ReactNode, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, Banknote, ChevronLeft, ChevronRight, MapPin, RotateCcw, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HomeData, HomeReview, Product, StoreSettings } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import { optimizedImage } from "../../lib/images";
import { formatPrice } from "../../lib/status";
import { dayRange } from "../../lib/days";
import { ProductCard } from "../ProductCard";
import { ProductPlaceholder } from "../ProductPlaceholder";
import { StarRating } from "../StarRating";

// A home page section with its title (and an optional link on the end side).
export function HomeSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="container-page py-10 sm:py-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Promises the store keeps, under the hero.
export function TrustStrip({ settings }: { settings?: StoreSettings }) {
  const { t, lang } = useI18n();
  const days = dayRange(lang, settings?.deliveryDaysMin ?? 2, settings?.deliveryDaysMax ?? 7);
  const items: { icon: LucideIcon; title: string; hint: string }[] = [
    { icon: Banknote, title: t("home.trust.cod"), hint: t("home.trust.codHint") },
    {
      icon: Truck,
      title:
        settings?.freeShippingThreshold != null && settings.freeShippingThreshold > 0
          ? t("home.trust.freeDelivery", { amount: formatPrice(settings.freeShippingThreshold) })
          : t("home.trust.delivery"),
      hint: t("home.trust.deliveryHint", { days }),
    },
    { icon: RotateCcw, title: t("home.trust.returns"), hint: t("home.trust.returnsHint") },
    { icon: Store, title: t("home.trust.makers"), hint: t("home.trust.makersHint") },
  ];
  return (
    <div className="border-b border-border bg-card">
      <ul className="container-page grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, hint }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryTiles({ categories, onSelect }: { categories: HomeData["categories"]; onSelect: (id: string) => void }) {
  const { t, tp } = useI18n();
  return (
    <HomeSection title={t("home.byCategory")}>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary text-start shadow-xs transition-shadow hover:shadow-lg"
          >
            {c.imageUrl ? (
              <img
                src={optimizedImage(c.imageUrl, 600)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <ProductPlaceholder name={c.name} />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4">
              <span className="block font-serif text-lg font-bold leading-tight text-white sm:text-xl">{c.name}</span>
              <span className="mt-0.5 block text-xs font-medium text-white/80">{tp("home.productCount", c.productCount)}</span>
            </span>
          </button>
        ))}
      </div>
    </HomeSection>
  );
}

// A row of product cards that scrolls sideways, with arrows on larger screens.
export function ProductRail({ title, products, seeAll }: { title: string; products: Product[]; seeAll?: { label: MessageKey; onClick: () => void } }) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: "smooth" });
  };
  return (
    <HomeSection
      title={title}
      action={
        <div className="flex items-center gap-2">
          {seeAll && (
            <button type="button" onClick={seeAll.onClick} className="link-accent me-2 inline-flex items-center gap-1 text-sm font-semibold">
              {t(seeAll.label)}
              <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </button>
          )}
          {products.length > 4 && (
            <>
              <button type="button" onClick={() => scroll(-1)} className="icon-btn hidden border border-border lg:inline-flex" aria-label={t("home.previous")}>
                <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
              </button>
              <button type="button" onClick={() => scroll(1)} className="icon-btn hidden border border-border lg:inline-flex" aria-label={t("home.next")}>
                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </>
          )}
        </div>
      }
    >
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 [scrollbar-width:none] sm:gap-5 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="w-[46%] flex-shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-15px)]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </HomeSection>
  );
}

export function FeaturedShop({ featured, wilayaName }: { featured: NonNullable<HomeData["featuredShop"]>; wilayaName?: string }) {
  const { t } = useI18n();
  const { shop, products } = featured;
  const about = shop.story || shop.description || t("shops.defaultDescription");
  return (
    <HomeSection title={t("home.featuredShop")}>
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <div className="relative h-40 overflow-hidden bg-secondary lg:h-56">
            {shop.coverUrl ? (
              <img src={optimizedImage(shop.coverUrl, 900)} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="hero-wash h-full w-full" />
            )}
          </div>
          <div className="px-6 pb-7 sm:px-8">
            <div className="-mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-accent-soft shadow-md">
              {shop.logoUrl ? (
                <img src={optimizedImage(shop.logoUrl, 160)} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-8 w-8 text-accent" />
              )}
            </div>
            <h3 className="mt-4 text-2xl font-bold text-foreground">{shop.name}</h3>
            {wilayaName && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {wilayaName}
              </p>
            )}
            <p className="mt-4 line-clamp-4 leading-relaxed text-muted-foreground">{about}</p>
            <Link to={`/shops/${shop.slug}`} className="btn-primary mt-6">
              {t("home.visitShop")}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border lg:col-span-3">
          {products.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="group relative block aspect-square overflow-hidden bg-card">
              {p.imageUrl ? (
                <img
                  src={optimizedImage(p.imageUrl, 500)}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <ProductPlaceholder name={p.name} />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                <span className="block font-serif text-sm font-bold text-white/90">{formatPrice(p.price)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </HomeSection>
  );
}

export function ReviewsStrip({ reviews }: { reviews: HomeReview[] }) {
  const { t } = useI18n();
  return (
    <HomeSection title={t("home.reviewsTitle")}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {reviews.slice(0, 6).map((r) => (
          <figure key={r.id} className="card flex w-[82%] flex-shrink-0 snap-start flex-col p-6 md:w-auto">
            <StarRating value={r.rating} />
            <blockquote className="mt-4 line-clamp-5 flex-1 font-serif text-lg leading-relaxed text-foreground">
              “{r.comment}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <Link to={`/products/${r.productId}`} className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
                {r.productImage ? (
                  <img src={optimizedImage(r.productImage, 88)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ProductPlaceholder name={r.productName} size="xs" />
                )}
              </Link>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-foreground">{r.author}</span>
                <Link to={`/products/${r.productId}`} className="block truncate text-muted-foreground hover:text-accent">
                  {t("home.bought", { product: r.productName })}
                </Link>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </HomeSection>
  );
}
