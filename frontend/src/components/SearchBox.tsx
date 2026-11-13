import { useEffect, useId, useMemo, useRef, useState, FormEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock, Search, Store, Tag, X } from "lucide-react";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { searchApi } from "../api/search";
import { useI18n } from "../i18n/I18nProvider";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatPrice } from "../lib/status";
import { optimizedImage } from "../lib/images";
import { clearRecentSearches, recentSearches, rememberSearch } from "../lib/recentSearches";
import { cn } from "@/lib/utils";

type Option =
  | { kind: "query"; query: string }
  | { kind: "recent"; query: string }
  | { kind: "product"; id: string; name: string; price: number; imageUrl?: string; soldOut: boolean }
  | { kind: "category"; id: string; name: string }
  | { kind: "shop"; slug: string; name: string; logoUrl?: string | null };

// The navbar search: suggestions as you type (products with photo and
// price, categories, shops), recent searches when empty, full keyboard
// support (↑ ↓ Enter Esc). Enter on the text searches the whole catalogue.
export function SearchBox({ autoFocus, onDone, className }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  const typed = query.trim();
  const debounced = useDebouncedValue(typed, 200);
  const { data, isFetching } = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: () => searchApi.suggest(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (open) setRecent(recentSearches());
  }, [open]);

  const options = useMemo<Option[]>(() => {
    if (!typed) return recent.map((q) => ({ kind: "recent", query: q }));
    const list: Option[] = [{ kind: "query", query: typed }];
    if (debounced.length >= 2 && data) {
      for (const p of data.products)
        list.push({ kind: "product", id: p.id, name: p.name, price: Number(p.price), imageUrl: p.imageUrl, soldOut: p.stock === 0 });
      for (const c of data.categories) list.push({ kind: "category", id: c.id, name: c.name });
      for (const s of data.shops) list.push({ kind: "shop", slug: s.slug, name: s.name, logoUrl: s.logoUrl });
    }
    return list;
  }, [typed, debounced, data, recent]);

  useEffect(() => setActive(-1), [typed]);

  function close() {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    onDone?.();
  }

  function choose(option: Option) {
    if (option.kind === "query" || option.kind === "recent") {
      rememberSearch(option.query);
      navigate(`/?search=${encodeURIComponent(option.query)}`);
      setQuery(option.query);
    } else {
      if (typed) rememberSearch(typed);
      if (option.kind === "product") navigate(`/products/${option.id}`);
      if (option.kind === "category") navigate(`/?category=${option.id}`);
      if (option.kind === "shop") navigate(`/shops/${option.slug}`);
      setQuery("");
    }
    close();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (active >= 0 && options[active]) choose(options[active]);
    else if (typed) choose({ kind: "query", query: typed });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycles through the options and back to the text itself (-1).
      setActive((i) => {
        const next = i + step;
        if (next < -1) return options.length - 1;
        if (next >= options.length) return -1;
        return next;
      });
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else close();
    }
  }

  const showList = open && options.length > 0;
  const noMatches =
    open && debounced.length >= 2 && data && !isFetching && options.length === 1 && typed === debounced;
  const optionId = (i: number) => `${listId}-option-${i}`;

  const section = (kind: Option["kind"], index: number) =>
    index === 0 || options[index - 1].kind !== kind ? kind : null;
  const sectionTitle: Partial<Record<Option["kind"], string>> = {
    recent: t("search.recent"),
    product: t("search.products"),
    category: t("search.categories"),
    shop: t("search.shops"),
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={t("search.label")}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={t("search.placeholder")}
        className="input h-10 ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t("home.clearSearch")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {(showList || noMatches) && (
        <div
          // Keeps focus in the input while clicking a suggestion.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg animate-fade-in"
        >
          {!typed && recent.length > 0 && (
            <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("search.recent")}</span>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches();
                  setRecent([]);
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t("search.clearRecent")}
              </button>
            </div>
          )}
          <ul id={listId} role="listbox" aria-label={t("search.label")}>
            {options.map((option, i) => {
              const heading = typed && option.kind !== "query" ? section(option.kind, i) : null;
              return (
                <li key={`${option.kind}-${i}`} role="presentation">
                  {heading && (
                    <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {sectionTitle[heading]}
                    </p>
                  )}
                  <div
                    id={optionId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                      active === i ? "bg-secondary text-foreground" : "text-foreground",
                    )}
                  >
                    <OptionContent option={option} />
                  </div>
                </li>
              );
            })}
          </ul>
          {noMatches && <p className="px-2.5 py-2 text-xs text-muted-foreground">{t("search.noSuggestions")}</p>}
        </div>
      )}
    </form>
  );
}

function OptionContent({ option }: { option: Option }) {
  const { t } = useI18n();
  switch (option.kind) {
    case "query":
      return (
        <>
          <Search className="h-4 w-4 flex-shrink-0 text-accent" />
          <span className="truncate">{t("search.searchFor", { q: option.query })}</span>
        </>
      );
    case "recent":
      return (
        <>
          <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{option.query}</span>
        </>
      );
    case "product":
      return (
        <>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
            {option.imageUrl ? (
              <img src={optimizedImage(option.imageUrl, 72)} alt="" className="h-full w-full object-cover" />
            ) : (
              <ProductPlaceholder name={option.name} size="xs" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{option.name}</span>
          <span className={cn("flex-shrink-0 text-xs font-semibold", option.soldOut ? "text-muted-foreground" : "text-foreground")}>
            {option.soldOut ? t("product.soldOut") : formatPrice(option.price)}
          </span>
        </>
      );
    case "category":
      return (
        <>
          <Tag className="h-4 w-4 flex-shrink-0 text-accent" />
          <span className="truncate">{option.name}</span>
        </>
      );
    case "shop":
      return (
        <>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft">
            {option.logoUrl ? (
              <img src={optimizedImage(option.logoUrl, 56)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-3.5 w-3.5 text-accent" />
            )}
          </span>
          <span className="truncate">{option.name}</span>
        </>
      );
  }
}
