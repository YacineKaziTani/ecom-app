import { useState } from "react";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X, SlidersHorizontal, Sparkles, PackageSearch } from "lucide-react";
import { productsApi, ProductSort } from "../api/products";
import { categoriesApi } from "../api/categories";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";
import { ProductGridSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: ProductSort; labelKey: MessageKey }[] = [
  { value: "newest", labelKey: "sort.newest" },
  { value: "price_asc", labelKey: "sort.priceAsc" },
  { value: "price_desc", labelKey: "sort.priceDesc" },
  { value: "name_asc", labelKey: "sort.nameAsc" },
];

export default function Shop() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);
  const { t, tp } = useI18n();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  // Don't fire a request (and burn rate limit) on every keystroke.
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ["products", { search: debouncedSearch, categoryId, sort, page }],
    queryFn: () =>
      productsApi.list({
        search: debouncedSearch,
        categoryId,
        sort,
        page,
        limit: 12,
      }),
  });

  const activeCategory = categories?.find((c) => c.id === categoryId);
  const hasFilters = Boolean(search || categoryId);

  function resetFilters() {
    setSearch("");
    setCategoryId("");
    setPage(1);
  }

  return (
    <div>
      {/* Hero ---------------------------------------------------- */}
      <section className="hero-wash relative overflow-hidden border-b border-border">
        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-2xl animate-fade-up">
            <span className="badge-accent mb-5 shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.badge")}
            </span>

            <h1 className="text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              {t("home.titleLine1")}
              <span className="block text-accent">{t("home.titleLine2")}</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("home.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#catalogue" className="btn-primary btn-lg">
                {t("home.browse")}
              </a>
              <Link to="/shops" className="btn-outline btn-lg">
                {t("home.meetMakers")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Filter bar ---------------------------------------------- */}
      <div
        id="catalogue"
        className="sticky top-16 z-40 border-b border-border bg-card/85 backdrop-blur-xl"
      >
        <div className="container-page py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("home.searchPlaceholder")}
                aria-label={t("home.searchPlaceholder")}
                className="input ps-10 pe-10"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={t("home.clearSearch")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground sm:block" />
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as ProductSort);
                  setPage(1);
                }}
                aria-label={t("home.sortLabel")}
                className="select lg:w-52"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category pills */}
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryPill
              active={categoryId === ""}
              onClick={() => {
                setCategoryId("");
                setPage(1);
              }}
            >
              {t("home.allProducts")}
            </CategoryPill>

            {categories?.map((c) => (
              <CategoryPill
                key={c.id}
                active={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setPage(1);
                }}
              >
                {c.name}
              </CategoryPill>
            ))}
          </div>
        </div>
      </div>

      {/* Results -------------------------------------------------- */}
      <div className="container-page py-10 sm:py-14">
        {!isLoading && data && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{tp("home.results", data.total)}</span>
              {activeCategory && <> {t("home.inCategory", { category: activeCategory.name })}</>}
              {search && <> {t("home.matching", { search })}</>}
            </p>

            {hasFilters && (
              <button onClick={resetFilters} className="btn-ghost btn-sm">
                <X className="h-3.5 w-3.5" />
                {t("home.clearFilters")}
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : data && data.items.length > 0 ? (
          <>
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
            title={t("home.emptyTitle")}
            description={
              hasFilters
                ? t("home.emptyFiltered")
                : t("home.emptyAll")
            }
            action={
              hasFilters ? (
                <button onClick={resetFilters} className="btn-primary">
                  {t("home.clearFilters")}
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "border border-border bg-card text-muted-foreground hover:border-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
