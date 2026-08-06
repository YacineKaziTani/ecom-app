import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { productsApi, ProductSort } from "../api/products";
import { categoriesApi } from "../api/categories";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";

export default function Shop() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", { search, categoryId, sort, page }],
    queryFn: () =>
      productsApi.list({ search, categoryId, sort, page, limit: 12 }),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-card to-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="font-serif font-bold text-4xl md:text-5xl mb-4">
              Discover Premium Collections
            </h1>
            <p className="text-muted-foreground text-lg">
              Curated luxury products from the world&apos;s finest sellers
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border-b border-border sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-secondary rounded-lg border border-border focus:outline-none focus:border-accent transition"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductSort);
                setPage(1);
              }}
              className="px-4 py-2 bg-secondary rounded-lg border border-border focus:outline-none focus:border-accent transition"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A-Z</option>
            </select>
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <button
              onClick={() => {
                setCategoryId("");
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                categoryId === ""
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-foreground hover:bg-border"
              }`}
            >
              All
            </button>
            {categories?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  categoryId === c.id
                    ? "bg-brand-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-muted-foreground">
                Loading premium products...
              </p>
            </div>
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              No products found. Try adjusting your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
