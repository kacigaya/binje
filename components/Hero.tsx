"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

function HeroLogo({
  item,
  className,
  ...props
}: {
  item: MediaItem;
  className: string;
  priority?: boolean;
  loading?: "eager";
  onLoad?: () => void;
  onError?: () => void;
}) {
  const logo = logoUrl(item.logo_path ?? null);
  if (!logo) return null;
  const logoBox = heroLogoBox(item.logo_width, item.logo_height);

  return (
    <Image
      {...props}
      src={logo}
      alt=""
      aria-hidden="true"
      width={item.logo_width ?? 500}
      height={item.logo_height ?? 200}
      sizes={logoBox.sizes}
      style={logoBox.style}
      className={`h-28 w-(--logo-width) object-contain object-left-bottom sm:h-36 sm:w-(--logo-width-sm) short:h-20 ${className}`}
    />
  );
}

export default function Hero({ items }: HeroProps) {
  const { locale, t } = useTranslations();
  const [activeIndex, setActiveIndex] = useState(0);
  // Keep the previous backdrop under the active one so the crossfade never shows the page background.
  const [baseIndex, setBaseIndex] = useState(0);
  // Load the next title hidden, then switch once its images are ready so text and pictures change together.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const pendingAssets = useRef(0);
  const [rotated, setRotated] = useState(false);
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

    const timeoutId = window.setTimeout(() => {
      const nextIndex = (activeIndex + 1) % safeItems.length;
      const next = safeItems[nextIndex];
      pendingAssets.current =
        Number(Boolean(next.backdrop_path)) + Number(Boolean(next.logo_path));
      setBaseIndex(activeIndex);
      if (pendingAssets.current === 0) {
        setActiveIndex(nextIndex);
        setRotated(true);
      } else {
        setPendingIndex(nextIndex);
      }
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, paused, rotates, safeItems]);

  // Failed images also count as settled so one broken asset cannot stop rotation.
  function settlePendingAsset(index: number) {
    if (index !== pendingIndex) return;
    pendingAssets.current -= 1;
    if (pendingAssets.current > 0) return;
    setActiveIndex(index);
    setPendingIndex(null);
    setRotated(true);
  }

  const itemAt = (index: number) =>
    safeItems.length > 0 ? safeItems[index % safeItems.length] : undefined;
  const activeItem = itemAt(activeIndex);
  if (!activeItem) return null;
  const pendingItem = pendingIndex === null ? undefined : itemAt(pendingIndex);

  // Bottom to top: previous, active, then the hidden incoming title.
  const backdropLayers = [
    { index: baseIndex, className: "" },
    { index: activeIndex, className: rotated ? "animate-hero-fade" : "" },
    ...(pendingIndex === null ? [] : [{ index: pendingIndex, className: "opacity-0" }]),
  ].filter(
    (layer, position, layers) =>
      layers.findLastIndex((other) => other.index === layer.index) === position,
  );

  const logo = logoUrl(activeItem.logo_path ?? null);
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
    // `lvh` ignores browser toolbar height. Mobile browsers change that height
    // when the keyboard opens, so `svh` moved the bottom-anchored content.
    <section className="relative flex min-h-[70lvh] w-full items-end overflow-hidden sm:min-h-[80lvh]">
      {backdropLayers.map(({ index, className }) => {
        const item = itemAt(index);
        if (!item?.backdrop_path) return null;
        const pending = index === pendingIndex;
        const first = index === 0 && !rotated;

        return (
          <Image
            key={`${item.media_type}-${item.id}`}
            src={item.backdrop_path}
            loader={tmdbBackdropLoader}
            alt={index === activeIndex ? activeItem.title : ""}
            aria-hidden={index === activeIndex ? undefined : true}
            fill
            priority={first}
            loading={pending ? "eager" : undefined}
            // `priority` emits a preload; `fetchPriority` keeps the first backdrop ahead of poster requests.
            fetchPriority={first ? "high" : undefined}
            onLoad={pending ? () => settlePendingAsset(index) : undefined}
            onError={pending ? () => settlePendingAsset(index) : undefined}
            className={`object-cover object-top ${className}`}
            sizes="100vw"
          />
        );
      })}

      {pendingItem?.logo_path && pendingIndex !== null && (
        <HeroLogo
          key={`logo-${pendingItem.media_type}-${pendingItem.id}`}
          item={pendingItem}
          loading="eager"
          onLoad={() => settlePendingAsset(pendingIndex)}
          onError={() => settlePendingAsset(pendingIndex)}
          className="pointer-events-none invisible absolute"
        />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

      {/* Content stays in flow so the hero grows instead of clipping it on short screens. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pt-28 pb-16 sm:px-6 sm:pb-24 short:pt-24 short:pb-16">
        <div className="max-w-2xl space-y-4">
          {/* Remount only the item details; the action row keeps focus during rotation. */}
          <div
            key={`${activeItem.media_type}-${activeItem.id}`}
            className={`space-y-4 ${rotated ? "animate-hero-fade" : ""}`}
          >
          {/* Fix the title slot height so logo loading cannot shift the bottom-anchored content. */}
          <div className="flex min-h-28 items-end sm:min-h-36 short:min-h-20">
            {logo ? (
              <>
                {/* Keep an h1 in the document when the logo replaces the visible title. */}
                <h1 className="sr-only">{activeItem.title}</h1>
                <HeroLogo item={activeItem} priority={!rotated} className="" />
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
            text={activeItem.overview}
            className="text-base sm:text-lg text-foreground/70 leading-relaxed max-w-xl"
          />
          </div>

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
    </section>
  );
}
