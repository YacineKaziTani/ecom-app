import { ShoppingBag } from "lucide-react";
import { useBrand } from "../hooks/useBrand";
import { splitWordmark } from "../lib/brand";
import { optimizedImage } from "../lib/images";
import { cn } from "@/lib/utils";

// The square mark beside the name: the shop's logo, or the shopping bag.
export function BrandMark({ className }: { className?: string }) {
  const { name, logoUrl } = useBrand();
  return logoUrl ? (
    <img
      src={optimizedImage(logoUrl, 96)}
      alt={name}
      className={cn("h-9 w-9 flex-shrink-0 rounded-lg object-cover shadow-sm", className)}
    />
  ) : (
    <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm", className)}>
      <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
    </span>
  );
}

// The shop's name in two tones ("Artisan" + accent "Shop").
export function Wordmark({ className }: { className?: string }) {
  const { name } = useBrand();
  const [plain, accent] = splitWordmark(name);
  return (
    <span className={cn("font-serif font-bold tracking-tight text-foreground", className)} dir="auto">
      {plain}
      {accent && <span className="text-accent">{accent}</span>}
    </span>
  );
}
