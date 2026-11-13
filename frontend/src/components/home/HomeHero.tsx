import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { HomeBanner, Product } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import { optimizedImage } from "../../lib/images";
import { ProductPlaceholder } from "../ProductPlaceholder";
import { cn } from "@/lib/utils";

// The top of the home page: the super admin's banners when there are some
// for this language, otherwise the brand hero with a collage of products.
export function HomeHero({ banners, products }: { banners: HomeBanner[]; products: Product[] }) {
  const { lang } = useI18n();
  const slides = banners.filter((b) => !b.lang || b.lang === lang);
  return slides.length > 0 ? <BannerSlider slides={slides} /> : <BrandHero products={products} />;
}

const SLIDE_MS = 6000;

function BannerSlider({ slides }: { slides: HomeBanner[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const current = Math.min(index, count - 1);
  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (count < 2 || paused || reduced) return;
    const timer = setTimeout(() => go(current + 1), SLIDE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, paused, count]);

  return (
    <section
      className="relative h-[440px] overflow-hidden bg-foreground sm:h-[500px] lg:h-[560px]"
      aria-roledescription="carousel"
      aria-label={t("home.highlights")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        // Swiping towards the reading direction's start shows the next slide.
        const rtl = document.documentElement.dir === "rtl";
        go(current + ((dx < 0) !== rtl ? 1 : -1));
      }}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={t("home.slideOf", { n: i + 1, total: count })}
          aria-hidden={i !== current}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-out",
            i === current ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <img
            src={optimizedImage(slide.imageUrl, 1800)}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className={cn("absolute inset-0 h-full w-full object-cover transition-transform duration-[7000ms] ease-out", i === current && "scale-105")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5 sm:bg-gradient-to-r sm:from-black/70 sm:via-black/35 sm:to-transparent rtl:sm:bg-gradient-to-l" />
          <div className="container-page relative flex h-full flex-col justify-end pb-14 sm:justify-center sm:pb-0">
            <div className="max-w-xl text-white">
              <h2 className="text-3xl font-bold leading-[1.1] text-white sm:text-5xl">{slide.title}</h2>
              {slide.subtitle && <p className="mt-4 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">{slide.subtitle}</p>}
              {slide.ctaLabel && slide.link && (
                <BannerLink link={slide.link} tabIndex={i === current ? 0 : -1}>
                  {slide.ctaLabel}
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </BannerLink>
              )}
            </div>
          </div>
        </div>
      ))}

      {count > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={t("home.slideOf", { n: i + 1, total: count })}
                aria-current={i === current}
                className={cn("h-2 rounded-full transition-all duration-300", i === current ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label={t("home.previous")}
            className="absolute start-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:flex"
          >
            <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label={t("home.next")}
            className="absolute end-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:flex"
          >
            <ChevronRight className="h-5 w-5 rtl:-scale-x-100" />
          </button>
        </>
      )}
    </section>
  );
}

function BannerLink({ link, tabIndex, children }: { link: string; tabIndex: number; children: React.ReactNode }) {
  const className =
    "mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-lg transition-transform hover:-translate-y-0.5";
  return link.startsWith("/") ? (
    <Link to={link} tabIndex={tabIndex} className={className}>
      {children}
    </Link>
  ) : (
    <a href={link} target="_blank" rel="noopener noreferrer" tabIndex={tabIndex} className={className}>
      {children}
    </a>
  );
}

// No banners: the brand message, with up to four products beside it.
function BrandHero({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const withPhoto = products.filter((p) => p.imageUrl);
  const tiles = [...withPhoto, ...products.filter((p) => !p.imageUrl)].slice(0, 4);

  return (
    <section className="hero-wash relative overflow-hidden border-b border-border">
      <div className="container-page relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div className="animate-fade-up">
          <span className="badge-accent mb-5 shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            {t("home.badge")}
          </span>
          <h1 className="text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            {t("home.titleLine1")}
            <span className="block text-accent">{t("home.titleLine2")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">{t("home.subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#catalogue" className="btn-primary btn-lg">
              {t("home.browse")}
            </a>
            <Link to="/shops" className="btn-outline btn-lg">
              {t("home.meetMakers")}
            </Link>
          </div>
        </div>

        {tiles.length >= 2 && (
          <div className="relative hidden h-[440px] md:block" aria-hidden>
            {tiles.map((p, i) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                tabIndex={-1}
                className={cn(
                  "absolute overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-transform duration-500 hover:z-10 hover:scale-[1.03]",
                  COLLAGE[i],
                )}
              >
                {p.imageUrl ? (
                  <img src={optimizedImage(p.imageUrl, 600)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ProductPlaceholder name={p.name} />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Positions of the four collage photos (a loose, overlapping arrangement).
const COLLAGE = [
  "start-[6%] top-0 h-[58%] w-[46%] -rotate-3 animate-fade-up",
  "end-[2%] top-[6%] h-[48%] w-[40%] rotate-2 animate-fade-up [animation-delay:120ms]",
  "start-[18%] bottom-0 h-[40%] w-[36%] rotate-1 animate-fade-up [animation-delay:240ms]",
  "end-[10%] bottom-[4%] h-[42%] w-[38%] -rotate-2 animate-fade-up [animation-delay:360ms]",
];
