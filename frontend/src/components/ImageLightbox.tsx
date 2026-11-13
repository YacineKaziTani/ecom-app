import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { optimizedImage } from "../lib/images";
import { cn } from "@/lib/utils";

// Full-screen photo viewer: arrows / swipe between photos, tap or click to
// zoom where you point, Escape to close.
export function ImageLightbox({
  images,
  index,
  alt,
  onIndex,
  onClose,
}: {
  images: string[];
  index: number;
  alt: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const count = images.length;
  const go = (next: number) => {
    setZoom(null);
    onIndex(((next % count) + count) % count);
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const rtl = document.documentElement.dir === "rtl";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(index + (rtl ? -1 : 1));
      if (e.key === "ArrowLeft") go(index + (rtl ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 animate-fade-in"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || zoom) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40 || count < 2) return;
        const rtl = document.documentElement.dir === "rtl";
        go(index + ((dx < 0) !== rtl ? 1 : -1));
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span aria-live="polite">{count > 1 ? `${index + 1} / ${count}` : ""}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
        <img
          src={optimizedImage(images[index], 2000)}
          alt={alt}
          onClick={(e) => {
            if (zoom) return setZoom(null);
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          className={cn(
            "max-h-full max-w-full select-none object-contain transition-transform duration-300",
            zoom ? "cursor-zoom-out" : "cursor-zoom-in",
          )}
          draggable={false}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="absolute start-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
              aria-label={t("home.previous")}
            >
              <ChevronLeft className="h-6 w-6 rtl:-scale-x-100" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="absolute end-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
              aria-label={t("home.next")}
            >
              <ChevronRight className="h-6 w-6 rtl:-scale-x-100" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => go(i)}
              aria-label={t("product.showPhoto")}
              aria-current={i === index}
              className={cn(
                "h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <img src={optimizedImage(url, 112)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
