import { useCallback, useEffect, useState } from "react";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X, SlidersHorizontal, Sparkles, PackageSearch } from "lucide-react";
import { productsApi, ProductSort } from "../api/products";
import { categoriesApi } from "../api/categories";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";
import { ProductGridSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { rememberSearch } from "../lib/recentSearches";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: ProductSort; labelKey: MessageKey; searchOnly?: boolean }[] = [
  { value: "relevance", labelKey: "sort.relevance", searchOnly: true },
  { value: "newest", labelKey: "sort.newest" },
  { value: "price_asc", labelKey: "sort.priceAsc" },
  { value: "price_desc", labelKey: "sort.priceDesc" },
  { value: "name_asc", labelKey: "sort.nameAsc" },
  { value: "rating_desc", labelKey: "sort.ratingDesc" },
];

// "" → no bound; anything else must be a non-negative number.
const priceBound = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export default function Shop() {
  const { t, tp } = useI18n();

  // Search and filters live in the URL (?search=&category=&min=&max=&stock=1
  // &sort=&page=): the navbar search lands here, results can be shared or
  // bookmarked, and the Back button works.
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const categoryId = params.get("category") ?? "";
  const minParam = params.get("min") ?? "";
  const maxParam = params.get("max") ?? "";
  const inStock = params.get("stock") === "1";
  const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);
  const sortParam = SORT_OPTIONS.find((o) => o.value === params.get("sort"))?.value;
  // Best matches first while searching, newest otherwise (same rule as the API).
  const sort: ProductSort = sortParam ?? (search ? "relevance" : "newest");

  // Changes a few parameters; any change other than the page goes back to page 1.
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          if (!("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const setPage = (n: number) => update({ page: n > 1 ? String(n) : null });

  // The text boxes write to the URL once typing pauses, and follow it when it
  // changes from elsewhere (navbar search, Back button).
  const [searchInput, setSearchInput] = useState(search);
  const [minInput, setMinInput] = useState(minParam);
  const [maxInput, setMaxInput] = useState(maxParam);
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => setMinInput(minParam), [minParam]);
  useEffect(() => setMaxInput(maxParam), [maxParam]);
  const typedSearch = useDebouncedValue(searchInput.trim(), 400);
  const typedMin = useDebouncedValue(minInput.trim());
  const typedMax = useDebouncedValue(maxInput.trim());
  useEffect(() => {
    if (typedSearch !== search) update({ search: typedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedSearch]);
  useEffect(() => {
    if (typedMin !== minParam) update({ min: typedMin || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedMin]);
  useEffect(() => {
    if (typedMax !== maxParam) update({ max: typedMax || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedMax]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const min = priceBound(minParam);
  const max = priceBound(maxParam);
  const { data, isLoading } = useQuery({
    queryKey: ["products", { search, categoryId, sort: sortParam, page, min, max, inStock }],
    queryFn: () =>
      productsApi.list({
        search: search || undefined,
        categoryId: categoryId || undefined,
        sort: sortParam,
        minPrice: min,
        maxPrice: max,
        inStock: inStock || undefined,
        page,
        limit: 12,
      }),
  });

  const activeCategory = categories?.find((c) => c.id === categoryId);
  const hasFilters = Boolean(search || categoryId || minParam || maxParam || inStock);
  // Searching or browsing a category: show the results first, without the banner.
  const showHero = !search && !categoryId;

  function resetFilters() {
    setParams({}, { replace: true });
  }

  function searchFor(query: string) {
    rememberSearch(query);
    update({ search: query });
  }

  return (
    <div>
      {/* Hero ---------------------------------------------------- */}
      {showHero && (
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
      )}

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
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchInput.trim()) searchFor(searchInput.trim());
                }}
                enterKeyHint="search"
                placeholder={t("home.searchPlaceholder")}
                aria-label={t("home.searchPlaceholder")}
                className="input ps-10 pe-10"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    update({ search: null });
                  }}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1
                             text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={t("home.clearSearch")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                inputMode="decimal"
                placeholder={t("home.minPrice")}
                aria-label={t("home.minPrice")}
                className="input w-24"
              />
              <span className="text-muted-foreground" aria-hidden>–</span>
              <input
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                inputMode="decimal"
                placeholder={t("home.maxPrice")}
                aria-label={t("home.maxPrice")}
                className="input w-24"
              />
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-1 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => update({ stock: e.target.checked ? "1" : null })}
                  className="h-4 w-4 accent-primary"
                />
                {t("home.inStockOnly")}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground sm:block" />
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value })}
                aria-label={t("home.sortLabel")}
                className="select lg:w-52"
              >
                {SORT_OPTIONS.filter((o) => !o.searchOnly || search).map((o) => (
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
              onClick={() => update({ category: null })}
            >
              {t("home.allProducts")}
            </CategoryPill>

            {categories?.map((c) => (
              <CategoryPill
                key={c.id}
                active={categoryId === c.id}
                onClick={() => update({ category: c.id })}
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
                <div className="flex flex-col items-center gap-3">
                  {data?.suggestion && (
                    <p className="text-sm text-foreground">
                      {t("search.didYouMean")}{" "}
                      <button onClick={() => searchFor(data.suggestion!)} className="link-accent font-semibold">
                        {data.suggestion}
                      </button>
                      {t("search.questionMark")}
                    </p>
                  )}
                  <button onClick={resetFilters} className="btn-primary">
                    {t("home.clearFilters")}
                  </button>
                </div>
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
