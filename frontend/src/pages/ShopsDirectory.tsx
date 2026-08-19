import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { shopsApi } from "../api/shops";

export default function ShopsDirectory() {
  const { data: shops, isLoading } = useQuery({
    queryKey: ["shops"],
    queryFn: shopsApi.list,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-card to-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="font-serif font-bold text-4xl md:text-5xl mb-4">
              Browse Premium Shops
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover curated selections from verified premium sellers
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Loading shops...</p>
          </div>
        ) : shops && shops.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                to={`/shops/${shop.slug}`}
                className="card group overflow-hidden p-5 transition-shadow hover:shadow-md"
              >
                <div className="group cursor-pointer h-full">
                  <div className="bg-card rounded-lg overflow-hidden border border-border hover:border-accent transition">
                    {/* Shop Image */}
                    <div className="aspect-video bg-secondary group-hover:bg-border transition flex items-center justify-center">
                      <img
                        src={shop.logoUrl}
                        alt={shop.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* Shop Info */}
                    <div className="p-6">
                      <h2 className="font-serif font-bold text-2xl mb-2">
                        {shop.name}
                      </h2>
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {shop.description}
                      </p>

                      <button className="w-full py-2 px-4 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-muted transition">
                        Visit Shop
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-gray-400">No shops yet.</div>
        )}
      </div>
    </div>
  );
}
