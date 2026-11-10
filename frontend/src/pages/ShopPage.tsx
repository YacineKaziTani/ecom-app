import { useState } from "react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Store, PackageSearch } from "lucide-react";
import { shopsApi } from "../api/shops";
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
  const { t } = useI18n();

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => shopsApi.bySlug(slug!),
    enabled: !!slug,
  });
  useDocumentMeta(shop?.name, shop?.description);

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

  return (
    <div className="container-page py-8 sm:py-10">
      <Link
        to="/shops"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t("shopPage.allShops")}
      </Link>

      {/* Shop banner ------------------------------------------- */}
      <div className="hero-wash mb-10 overflow-hidden rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {shop.logoUrl ? (
              <img
                src={optimizedImage(shop.logoUrl, 256)}
                alt={shop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-9 w-9 text-accent" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("shopPage.eyebrow")}</p>
            <h1 className="mt-1.5 text-3xl font-bold text-foreground sm:text-4xl">
              {shop.name}
            </h1>
            <p className="mt-2.5 max-w-xl leading-relaxed text-muted-foreground">
              {shop.description || t("shops.defaultDescription")}
            </p>
          </div>

          {data && (
            <div className="flex-shrink-0 rounded-xl border border-border bg-card px-5 py-4 text-center shadow-xs">
              <p className="font-serif text-3xl font-bold text-foreground">
                {data.total}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("shopPage.productsLabel")}
              </p>
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
