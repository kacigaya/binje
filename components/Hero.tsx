"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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

/** Auto-advance delay; swiping or picking a title restarts it. */
const ROTATION_MS = 15000;

export default function Hero({ items }: HeroProps) {
  const { t } = useTranslations();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const rotates = !reducedMotion;

  const safeItems = useMemo(
    () => items.filter((item) => Boolean(item?.id)),
    [items],
  );
  const count = safeItems.length;

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollTo({
        left: index * track.clientWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  // The scroll position is the source of truth, so swipes and buttons stay in sync.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (track.clientWidth === 0) return;
        setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    // Disable automatic rotation for reduced motion; everyone else gets a pause control.
    if (count <= 1 || paused || !rotates) return;
    const timeoutId = window.setTimeout(
      () => scrollToIndex((activeIndex + 1) % count),
      ROTATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, count, paused, rotates, scrollToIndex]);

  if (count === 0) return null;

  return (
    <section
      className="relative w-full"
      aria-roledescription="carousel"
      aria-label={t("Featured titles")}
    >
      <div
        ref={trackRef}
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {safeItems.map((item, index) => (
          <HeroSlide
            key={item.id}
            item={item}
            first={index === 0}
            active={index === activeIndex}
            label={`${index + 1} / ${count}`}
          />
        ))}
      </div>

      {count > 1 && (
        // Sits above the overlapping first rail, which covers the bottom 3rem.
        <div className="pointer-events-none absolute inset-x-0 bottom-16 sm:bottom-20 short:bottom-16">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 sm:px-6">
            <div className="pointer-events-auto flex items-center">
              {safeItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToIndex(index)}
                    aria-label={item.title}
                    aria-current={isActive ? "true" : undefined}
                    className="group flex h-6 cursor-pointer items-center px-1 focus-visible:outline-none"
                  >
                    <span
                      className={`block h-1 rounded-full transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-accent-red/60 motion-reduce:transition-none ${
                        isActive ? "w-8 bg-white" : "w-5 bg-white/30 group-hover:bg-white/60"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {rotates && (
              <button
                type="button"
                onClick={() => setPaused((previous) => !previous)}
                aria-pressed={paused}
                aria-label={
                  paused
                    ? t("Resume featured titles")
                    : t("Pause featured titles")
                }
                className="pointer-events-auto flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
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
      )}
    </section>
  );
}

function HeroSlide({
  item,
  first,
  active,
  label,
}: {
  item: MediaItem;
  first: boolean;
  active: boolean;
  label: string;
}) {
  const { locale, t } = useTranslations();
  const backdrop = item.backdrop_path;
  const logo = logoUrl(item.logo_path ?? null);
  const logoBox = heroLogoBox(item.logo_width, item.logo_height);
  const detailHref =
    item.media_type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
  const watchHref =
    item.media_type === "tv" ? `/watch/tv/${item.id}` : `/watch/${item.id}`;
  const rating = formatRating(locale, item.vote_average) ?? t("N/A");
  // Only the visible slide is exposed, so the page keeps exactly one h1.
  const Heading = active ? "h1" : "h2";

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      // Off-screen slides stay out of the tab order and the accessibility tree.
      inert={!active}
      className="relative flex min-h-[70svh] w-full shrink-0 snap-start snap-always items-end sm:min-h-[80svh]"
    >
      {backdrop && (
        <Image
          src={backdrop}
          loader={tmdbBackdropLoader}
          alt={item.title}
          fill
          priority={first}
          // `priority` emits a preload; `fetchPriority` keeps the first backdrop ahead of poster requests.
          fetchPriority={first ? "high" : undefined}
          className="object-cover object-top"
          sizes="100vw"
        />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

      {/* Content stays in flow so the hero grows instead of clipping it on short screens. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pt-28 pb-28 sm:px-6 sm:pb-36 short:pt-24 short:pb-28">
        <div className="max-w-2xl space-y-4">
          {/* Fix the title slot height so logo loading cannot shift the bottom-anchored content. */}
          <div className="flex min-h-28 items-end sm:min-h-36 short:min-h-20">
            {logo ? (
              <>
                {/* Keep a heading in the document when the logo replaces the visible title. */}
                <Heading className="sr-only">{item.title}</Heading>
                <Image
                  src={logo}
                  alt=""
                  aria-hidden="true"
                  width={item.logo_width ?? 500}
                  height={item.logo_height ?? 200}
                  priority={first}
                  sizes={logoBox.sizes}
                  style={logoBox.style}
                  className="h-28 w-(--logo-width) object-contain object-left-bottom sm:h-36 sm:w-(--logo-width-sm) short:h-20"
                />
              </>
            ) : (
              <Heading
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none text-balance"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {item.title}
              </Heading>
            )}
          </div>

          <div className="flex items-center gap-3">
            {item.media_type === "tv" && (
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
            <RottenTomatoesRating imdbId={item.imdbId} />
            {item.contentRating && (
              <span className="rounded border border-white/25 px-1.5 text-xs font-semibold text-foreground/80">
                {item.contentRating}
              </span>
            )}
            {item.date && (
              <span className="text-sm text-muted-foreground">
                {new Date(item.date).getFullYear()}
              </span>
            )}
          </div>

          <ExpandableOverview
            text={item.overview}
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
          </div>
        </div>
      </div>
    </div>
  );
}
