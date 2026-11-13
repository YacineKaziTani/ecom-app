import { useQuery } from "@tanstack/react-query";
import { homeApi } from "../../api/home";
import { shippingApi } from "../../api/shipping";
import { useStoreSettings } from "../../hooks/useStoreSettings";
import { useI18n } from "../../i18n/I18nProvider";
import { HomeHero } from "./HomeHero";
import { CategoryTiles, FeaturedShop, ProductRail, ReviewsStrip, TrustStrip } from "./HomeRows";

// Everything above the catalogue on the home page. Sections without content
// (no categories yet, no reviews yet…) are simply left out.
export function HomeSections({ onCategory, onPromotions }: { onCategory: (id: string) => void; onPromotions: () => void }) {
  const { t, lang } = useI18n();
  const { data } = useQuery({ queryKey: ["home"], queryFn: homeApi.get, staleTime: 60 * 1000 });
  const { data: settings } = useStoreSettings();
  const { data: zones } = useQuery({ queryKey: ["shipping-zones"], queryFn: shippingApi.zones, staleTime: 5 * 60 * 1000 });

  // Best sellers first, then new arrivals, each product once.
  const collage = [...(data?.bestSellers ?? []), ...(data?.newArrivals ?? [])].filter(
    (p, i, list) => list.findIndex((q) => q.id === p.id) === i,
  );
  const featured = data?.featuredShop;
  const zone = featured?.shop.wilayaCode ? zones?.find((z) => z.code === featured.shop.wilayaCode) : undefined;
  const wilayaName = zone ? (lang === "ar" && zone.nameAr ? zone.nameAr : zone.name) : undefined;

  return (
    <>
      <HomeHero banners={data?.banners ?? []} products={collage} />
      <TrustStrip settings={settings} />
      {data && data.categories.length >= 2 && <CategoryTiles categories={data.categories} onSelect={onCategory} />}
      {data && data.newArrivals.length > 0 && (
        <ProductRail
          title={t("home.newArrivals")}
          products={data.newArrivals}
          // The catalogue below is already newest first.
          seeAll={{ label: "home.seeAll", onClick: () => document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" }) }}
        />
      )}
      {data && data.onSale.length > 0 && (
        <ProductRail title={t("home.onSale")} products={data.onSale} seeAll={{ label: "home.seeAll", onClick: onPromotions }} />
      )}
      {data && data.bestSellers.length >= 2 && <ProductRail title={t("home.bestSellers")} products={data.bestSellers} />}
      {featured && featured.products.length > 0 && <FeaturedShop featured={featured} wilayaName={wilayaName} />}
      {data && data.reviews.length > 0 && <ReviewsStrip reviews={data.reviews} />}
    </>
  );
}
