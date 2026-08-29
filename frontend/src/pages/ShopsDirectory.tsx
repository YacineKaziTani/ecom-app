import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, ArrowRight } from "lucide-react";
import { shopsApi } from "../api/shops";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export default function ShopsDirectory() {
  const { data: shops, isLoading } = useQuery({
    queryKey: ["shops"],
    queryFn: shopsApi.list,
  });

  return (
    <div>
      <PageHeader
        variant="hero"
        eyebrow="The makers"
        title="Browse independent shops"
        description="Every shop here is run by the person who makes the goods. Find one whose work you love and follow it."
      />

      <div className="container-page py-12 sm:py-16">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : shops && shops.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                to={`/shops/${shop.slug}`}
                className="card-interactive group flex flex-col overflow-hidden"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-secondary to-muted">
                  {shop.logoUrl ? (
                    <img
                      src={shop.logoUrl}
                      alt={shop.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Store className="h-9 w-9 text-muted-foreground" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-serif text-xl font-bold text-foreground transition-colors group-hover:text-accent">
                    {shop.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {shop.description || "Independent artisan shop"}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    Visit shop
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="No shops yet"
            description="Nobody has opened a shop on the platform so far. Check back soon."
          />
        )}
      </div>
    </div>
  );
}
