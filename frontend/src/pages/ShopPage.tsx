import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Store } from "lucide-react";
import { shopsApi } from "../api/shops";
import { productsApi, ProductSort } from "../api/products";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";

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
    queryFn: () =>
      productsApi.list({ shopId: shop!.id, sort, page, limit: 12 }),
    enabled: !!shop,
  });

  if (shopLoading)
    return (
      <div className="py-20 text-center text-gray-400">Loading shop...</div>
    );
  if (!shop)
    return (
      <div className="py-20 text-center text-gray-400">Shop not found.</div>
    );

  return (
    <div>
      <Link
        to="/shops"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> All shops
      </Link>

      <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-secondary shadow-sm">
        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-accent/10 shadow-sm">
            {shop.logoUrl ? (
              <img
                src={shop.logoUrl}
                alt={shop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-9 w-9 text-accent" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {shop.name}
            </h1>
            <p className="mt-1.5 max-w-xl text-muted-foreground">
              {shop.description || "Independent artisan shop"}
            </p>
            {data && (
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-accent">
                {data.total} {data.total === 1 ? "product" : "products"}
              </p>
            )}
          </div>
        </div>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="aspect-square w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-5 w-1/4 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {data.items.length} of {data.total}
            </p>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductSort);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground transition focus:border-accent focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A-Z</option>
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">
            This shop hasn't listed any products yet.
          </p>
        </div>
      )}
    </div>
  );
}
