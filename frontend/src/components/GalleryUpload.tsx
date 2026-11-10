import { X } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { optimizedImage } from "../lib/images";
import { useI18n } from "../i18n/I18nProvider";

// Up to `max` extra product photos: thumbnails with remove, plus an uploader.
export function GalleryUpload({
  value,
  onChange,
  max = 8,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const { t } = useI18n();
  return (
    <div>
      <p className="label">{t("gallery.more", { count: value.length, max })}</p>
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-secondary">
            <img src={optimizedImage(url, 160)} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute end-1 top-1 rounded-full bg-foreground/70 p-0.5 text-background opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={t("gallery.remove")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {value.length < max && (
        <div className="mt-2">
          {/* Re-mounts after each upload so it always shows the empty drop zone. */}
          <ImageUpload key={value.length} value="" folder="products" label=""
            onChange={(url) => url && onChange([...value, url])} />
        </div>
      )}
    </div>
  );
}
