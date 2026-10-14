"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { Info, Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import WatchNowLink from "@/components/WatchNowLink";
import IntentPrefetchLink from "@/components/IntentPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import type { MediaItem } from "@/types/tmdb";
import { logoUrl } from "@/lib/tmdb";
import ExpandableOverview from "@/components/ExpandableOverview";
import { formatRating, localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";

interface HeroProps {
  items: MediaItem[];
}

function tmdbBackdropLoader({ src, width }: ImageLoaderProps) {
  const size = width <= 780 ? "w780" : "w1280";
  return `https://image.tmdb.org/t/p/${size}${src}`;
}

/** Rendered box the logo is capped to, mirroring the Tailwind classes below. */
const LOGO_HEIGHT = { mobile: 112, desktop: 144 } as const; // h-28 / sm:h-36
const LOGO_MAX_WIDTH = { mobile: 320, desktop: 512 } as const; // max-w-xs / sm:max-w-lg

/** Set `sizes` to avoid oversized image downloads and reserve width to prevent layout shifts. */
function heroLogoBox(width?: number, height?: number) {
  const ratio = width && height ? width / height : 2.5;
  const widthAt = (cap: keyof typeof LOGO_HEIGHT) =>
    Math.round(Math.min(LOGO_HEIGHT[cap] * ratio, LOGO_MAX_WIDTH[cap]));

  const mobile = widthAt("mobile");
  const desktop = widthAt("desktop");
  return {
    sizes: `(max-width: 640px) ${mobile}px, ${desktop}px`,
    style: {
      "--logo-width": `${mobile}px`,
      "--logo-width-sm": `${desktop}px`,
    } as CSSProperties,
  };
}

export default function Hero({ items }: HeroProps) {
  const { locale, t } = useTranslations();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const rotates = !reducedMotion;

  const safeItems = useMemo(
    () => items.filter((item) => Boolean(item?.id)),
    [items],
  );

  useEffect(() => {
    // Disable automatic rotation for reduced motion; everyone else gets a pause control.
    if (safeItems.length <= 1 || paused || !rotates) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((previousIndex) => (previousIndex + 1) % safeItems.length);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [paused, rotates, safeItems.length]);

  const normalizedIndex =
    safeItems.length > 0 ? activeIndex % safeItems.length : 0;
  const activeItem = safeItems[normalizedIndex];
  if (!activeItem) return null;

  const backdrop = activeItem.backdrop_path;
  const logo = logoUrl(activeItem.logo_path ?? null);
  const logoBox = heroLogoBox(activeItem.logo_width, activeItem.logo_height);
  const detailHref =
    activeItem.media_type === "tv"
      ? `/tv/${activeItem.id}`
      : `/movie/${activeItem.id}`;
  const watchHref =
    activeItem.media_type === "tv"
      ? `/watch/tv/${activeItem.id}`
      : `/watch/${activeItem.id}`;
  const rating = formatRating(locale, activeItem.vote_average) ?? t("N/A");

  return (
    <section className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
      {backdrop && (
        <Image
          src={backdrop}
          loader={tmdbBackdropLoader}
          alt={activeItem.title}
          fill
          priority
          // `priority` emits a preload; `fetchPriority` keeps the backdrop ahead of poster requests.
          fetchPriority="high"
          className="object-cover object-top"
          sizes="100vw"
        />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-2xl space-y-4">
            {/* Fix the title slot height so logo loading cannot shift the bottom-anchored content. */}
            <div className="flex min-h-28 items-end sm:min-h-36">
              {logo ? (
                <>
                  {/* Keep an h1 in the document when the logo replaces the visible title. */}
                  <h1 className="sr-only">{activeItem.title}</h1>
                  <Image
                    src={logo}
                    alt=""
                    aria-hidden="true"
                    width={activeItem.logo_width ?? 500}
                    height={activeItem.logo_height ?? 200}
                    priority
                    sizes={logoBox.sizes}
                    style={logoBox.style}
                    className="h-28 w-(--logo-width) object-contain object-left-bottom sm:h-36 sm:w-(--logo-width-sm)"
                  />
                </>
              ) : (
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none text-balance"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {activeItem.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeItem.media_type === "tv" && (
                <Badge className="border-white/20 bg-white/10 text-xs text-foreground hover:bg-white/10">
                  {t("TV Series")}
                </Badge>
              )}
              <div className="flex items-center gap-1.5 font-semibold">
                <Image
                  src="/tmdb.svg"
                  alt=""
                  width={37}
                  height={16}
                  aria-hidden="true"
                  className="h-4 w-auto shrink-0"
                />
                <span className="text-sm tabular-nums">{rating}</span>
              </div>
              <RottenTomatoesRating imdbId={activeItem.imdbId} />
              {activeItem.contentRating && (
                <span className="rounded border border-white/25 px-1.5 text-xs font-semibold text-foreground/80">
                  {activeItem.contentRating}
                </span>
              )}
              {activeItem.date && (
                <span className="text-sm text-muted-foreground">
                  {new Date(activeItem.date).getFullYear()}
                </span>
              )}
            </div>

            <ExpandableOverview
              key={activeItem.id}
              text={activeItem.overview}
              className="text-base sm:text-lg text-foreground/70 leading-relaxed max-w-xl"
            />

            <div className="flex items-center gap-3 pt-2">
              <WatchNowLink
                href={localizedHref(locale, watchHref)}
                label={t("Watch Now")}
                className={buttonClassName({
                  size: "lg",
                  className:
                    "rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-6 sm:px-8 h-12 text-base cursor-pointer",
                })}
              />
              <IntentPrefetchLink
                href={localizedHref(locale, detailHref)}
                className={buttonClassName({
                  size: "lg",
                  variant: "outline",
                  className:
                    "rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-foreground gap-2 px-6 sm:px-8 h-12 text-base cursor-pointer",
                })}
              >
                <Info className="size-5" />
                {t("Details")}
              </IntentPrefetchLink>
              {/* Keep this in the action row so the overlapping first rail cannot hide it. */}
              {rotates && safeItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPaused((previous) => !previous)}
                  aria-pressed={paused}
                  aria-label={
                    paused
                      ? t("Resume featured titles")
                      : t("Pause featured titles")
                  }
                  className="ml-auto flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 sm:ml-2"
                >
                  {paused ? (
                    <Play aria-hidden="true" className="size-4" />
                  ) : (
                    <Pause aria-hidden="true" className="size-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
