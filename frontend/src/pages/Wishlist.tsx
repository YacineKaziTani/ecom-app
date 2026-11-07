import { Link } from "react-router";
import { useI18n } from "../i18n/I18nProvider";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { Heart } from "lucide-react";
import { useWishlist } from "../hooks/useWishlist";
import { ProductCard } from "../components/ProductCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";

export default function Wishlist() {
  const { items } = useWishlist();
  const { t } = useI18n();
  useDocumentMeta(t("wishlist.title"));
  return (
    <div>
      <PageHeader variant="hero" eyebrow={t("orders.eyebrow")} title={t("wishlist.title")} description={t("wishlist.subtitle")} />
      <div className="container-page py-10">
        {items.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => (
              <ProductCard key={i.id} product={i.product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title={t("wishlist.emptyTitle")}
            description={t("wishlist.emptyBody")}
            action={<Link to="/" className="btn-primary">{t("wishlist.browse")}</Link>}
          />
        )}
      </div>
    </div>
  );
}
