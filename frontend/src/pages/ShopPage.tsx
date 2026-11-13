import { useState } from "react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, MapPin, Store, PackageSearch } from "lucide-react";
import { shopsApi } from "../api/shops";
import { shippingApi } from "../api/shipping";
import { StarRating } from "../components/StarRating";
import { productsApi, ProductSort } from "../api/products";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";
import { ProductGridSkeleton, Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { optimizedImage } from "../lib/images";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const SORT_OPTIONS: { value: ProductSort; labelKey: MessageKey }[] = [
  { value: "newest", labelKey: "sort.newest" },
  { value: "price_asc", labelKey: "sort.priceAsc" },
  { value: "price_desc", labelKey: "sort.priceDesc" },
  { value: "name_asc", labelKey: "sort.nameAsc" },
  { value: "rating_desc", labelKey: "sort.ratingDesc" },
];

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");
  const { t, tp, lang } = useI18n();

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => shopsApi.bySlug(slug!),
    enabled: !!slug,
  });
  useDocumentMeta(shop?.name, shop?.description);
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 5 * 60 * 1000 });

  const { data, isLoading: productsLoading } = useQuery({
    queryKey: ["products", { shopId: shop?.id, sort, page }],
    queryFn: () => productsApi.list({ shopId: shop!.id, sort, page, limit: 12 }),
    enabled: !!shop,
  });

  if (shopLoading) {
    return (
      <div className="container-page py-10">
        <Skeleton className="mb-8 h-4 w-24" />
        <Skeleton className="mb-8 h-44 w-full rounded-2xl" />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={Store}
          title={t("shopPage.notFoundTitle")}
          description={t("shopPage.notFoundBody")}
          action={
            <Link to="/shops" className="btn-primary">
              {t("shopPage.browseAll")}
            </Link>
          }
        />
      </div>
    );
  }

  const zone = shop.wilayaCode ? zones?.find((z) => z.code === shop.wilayaCode) : undefined;
  const wilayaName = zone ? (lang === "ar" && zone.nameAr ? zone.nameAr : zone.name) : undefined;
  const socials = (
    [
      ["Instagram", shop.instagramUrl],
      ["Facebook", shop.facebookUrl],
      ["TikTok", shop.tiktokUrl],
    ] as [string, string | null | undefined][]
  ).filter((entry): entry is [string, string] => !!entry[1]);

  return (
    <div className="container-page py-8 sm:py-10">
      <Link
        to="/shops"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t("shopPage.allShops")}
      </Link>

      {/* Shop header: cover, logo, name, where, stats, links ------- */}
      <div className="mb-10 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative h-40 bg-secondary sm:h-56 lg:h-64">
          {shop.coverUrl ? (
            <img src={optimizedImage(shop.coverUrl, 1600)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="hero-wash h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <div className="px-6 pb-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="-mt-12 flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-accent-soft shadow-md sm:-mt-14 sm:h-28 sm:w-28">
              {shop.logoUrl ? (
                <img src={optimizedImage(shop.logoUrl, 256)} alt={shop.name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-10 w-10 text-accent" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t("shopPage.eyebrow")}</p>
              <h1 className="mt-1 text-3xl font-bold text-foreground sm:text-4xl">{shop.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {wilayaName && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {wilayaName}
                  </span>
                )}
                {(shop.stats?.ratingCount ?? 0) > 0 && (
                  <StarRating value={shop.stats!.ratingAverage} count={shop.stats!.ratingCount} />
                )}
                <span>{tp("home.productCount", shop.stats?.productCount ?? data?.total ?? 0)}</span>
                <span>{t("shopPage.since", { year: new Date(shop.createdAt).getFullYear() })}</span>
              </div>
            </div>
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socials.map(([name, url]) => (
                  <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                    {name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">
            {shop.description || t("shops.defaultDescription")}
          </p>

          {shop.story && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-foreground">{t("shopPage.story")}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground/85">{shop.story}</p>
            </div>
          )}
        </div>
      </div>

      {/* Products ---------------------------------------------- */}
      {productsLoading ? (
        <ProductGridSkeleton count={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("shopPage.showing", { shown: data.items.length, total: data.total })}
            </p>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductSort);
                setPage(1);
              }}
              aria-label={t("shopPage.sortLabel")}
              className="select w-52"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t("shopPage.emptyTitle")}
          description={t("shopPage.emptyBody", { shop: shop.name })}
          action={
            <Link to="/" className="btn-outline">
              {t("shopPage.browseOther")}
            </Link>
          }
        />
      )}
    </div>
  );
}
