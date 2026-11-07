import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

// Builds a compact page list like: 1 … 4 5 [6] 7 8 … 20
function buildPageList(page: number, totalPages: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 1) range.push("...");
  if (totalPages > 1) range.push(totalPages);

  return range;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = buildPageList(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        {t("pagination.showing", { start, end, total })}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card
                     text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground
                     disabled:pointer-events-none disabled:opacity-40"
          aria-label={t("pagination.previous")}
        >
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1.5 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "h-9 w-9 rounded-lg text-sm font-semibold transition-all duration-200",
                p === page
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:border-accent/50 hover:text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card
                     text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground
                     disabled:pointer-events-none disabled:opacity-40"
          aria-label={t("pagination.next")}
        >
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </div>
    </nav>
  );
}
