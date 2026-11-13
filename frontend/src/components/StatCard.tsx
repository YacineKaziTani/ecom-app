import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "brand" | "amber" | "rose" | "blue" | "green";

const accents: Record<Accent, string> = {
  brand: "bg-accent-soft text-accent",
  amber: "bg-warning-soft text-warning",
  rose: "bg-destructive-soft text-destructive",
  blue: "bg-info-soft text-info",
  green: "bg-success-soft text-success",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: Accent;
  hint?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "card group relative overflow-hidden p-5 transition-all duration-300 hover:shadow-md",
        className,
      )}
    >
      {/* Faint corner wash that lifts on hover. */}
      <div className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-accent/5 transition-transform duration-500 group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase leading-snug tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-serif text-3xl font-bold leading-none text-foreground">
            {value}
          </p>
          {hint && (
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>

        <div
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
            accents[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
