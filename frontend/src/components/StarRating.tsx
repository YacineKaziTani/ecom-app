import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n/I18nProvider";

// Read-only stars, e.g. ★★★★☆ (4.3)
export function StarRating({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  return (
    <span className="inline-flex items-center gap-1" aria-label={t("stars.rated", { value: value.toFixed(1) })}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(icon, n <= Math.round(value) ? "fill-warning text-warning" : "text-border")}
          />
        ))}
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">
          {value.toFixed(1)} ({count})
        </span>
      )}
    </span>
  );
}

// Clickable 1–5 stars for the review form.
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useI18n();
  return (
    <span className="flex gap-1" role="radiogroup" aria-label={t("stars.yourRating")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("stars.n", { n })}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star className={cn("h-6 w-6", n <= value ? "fill-warning text-warning" : "text-border")} />
        </button>
      ))}
    </span>
  );
}
