import { useState } from "react";
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

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A–Z" },
];

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => shopsApi.bySlug(slug!),
    enabled: !!slug,
  });

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
          title="Shop not found"
          description="This shop may have closed or the link is out of date."
          action={
            <Link to="/shops" className="btn-primary">
              Browse all shops
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
        <ArrowLeft className="h-4 w-4" /> All shops
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
            <p className="eyebrow">Artisan shop</p>
            <h1 className="mt-1.5 text-3xl font-bold text-foreground sm:text-4xl">
              {shop.name}
            </h1>
            <p className="mt-2.5 max-w-xl leading-relaxed text-muted-foreground">
              {shop.description || "Independent artisan shop"}
            </p>
          </div>

          {data && (
            <div className="flex-shrink-0 rounded-xl border border-border bg-card px-5 py-4 text-center shadow-xs">
              <p className="font-serif text-3xl font-bold text-foreground">
                {data.total}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {data.total === 1 ? "Product" : "Products"}
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
              Showing{" "}
              <span className="font-semibold text-foreground">
                {data.items.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">{data.total}</span>
            </p>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductSort);
                setPage(1);
              }}
              aria-label="Sort products"
              className="select w-52"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
          title="No products listed yet"
          description={`${shop.name} hasn't added any products so far. Check back soon.`}
          action={
            <Link to="/" className="btn-outline">
              Browse other products
            </Link>
          }
        />
      )}
    </div>
  );
}
