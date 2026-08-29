"use client";

import { useEffect, useMemo, useState } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { Info } from "lucide-react";
import WatchNowLink from "@/components/WatchNowLink";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import type { MediaItem } from "@/types/tmdb";
import { logoUrl } from "@/lib/tmdb";
import ExpandableOverview from "@/components/ExpandableOverview";
import { localizedHref } from "@/lib/i18n";
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
const LOGO_MAX_HEIGHT = { mobile: 112, desktop: 144 } as const; // max-h-28 / sm:max-h-36
const LOGO_MAX_WIDTH = { mobile: 320, desktop: 512 } as const; // max-w-xs / sm:max-w-lg

/**
 * Without `sizes`, next/image treats a fixed-width image as full-bleed and
 * requests the 1x/2x device widths — a 1280px PNG for a box that is never
 * wider than ~360px. The logo's own aspect ratio tells us the real box.
 */
function heroLogoSizes(width?: number, height?: number) {
  const ratio = width && height ? width / height : 2.5;
  const at = (cap: keyof typeof LOGO_MAX_HEIGHT) =>
    Math.round(Math.min(LOGO_MAX_HEIGHT[cap] * ratio, LOGO_MAX_WIDTH[cap]));
  return `(max-width: 640px) ${at("mobile")}px, ${at("desktop")}px`;
}

export default function Hero({ items }: HeroProps) {
  const { locale, t } = useTranslations();
  const [activeIndex, setActiveIndex] = useState(0);

  const safeItems = useMemo(
    () => items.filter((item) => Boolean(item?.id)),
    [items],
  );

  useEffect(() => {
    if (safeItems.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((previousIndex) => (previousIndex + 1) % safeItems.length);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [safeItems.length]);

  const normalizedIndex =
    safeItems.length > 0 ? activeIndex % safeItems.length : 0;
  const activeItem = safeItems[normalizedIndex];
  if (!activeItem) return null;

  const backdrop = activeItem.backdrop_path;
  const logo = logoUrl(activeItem.logo_path ?? null);
  const logoSizes = heroLogoSizes(
    activeItem.logo_width,
    activeItem.logo_height,
  );
  const detailHref =
    activeItem.media_type === "tv"
      ? `/tv/${activeItem.id}`
      : `/movie/${activeItem.id}`;
  const watchHref =
    activeItem.media_type === "tv"
      ? `/watch/tv/${activeItem.id}`
      : `/watch/${activeItem.id}`;
  const rating = Number.isFinite(activeItem.vote_average)
    ? activeItem.vote_average.toFixed(1)
    : t("N/A");

  return (
    <section className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
      {backdrop && (
        <Image
          src={backdrop}
          loader={tmdbBackdropLoader}
          alt={activeItem.title}
          fill
          priority
          // `priority` only emits the preload; without this the backdrop is
          // fetched at Low priority and loses the race to the poster rows.
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
            {/*
              The hero content is bottom-anchored, so anything that resolves to
              a different height after paint drags the whole column upwards.
              Pinning the title slot keeps that height fixed whether the item
              has a logo, has none, or has one that has not decoded yet.
            */}
            <div className="flex min-h-28 items-end sm:min-h-36">
              {logo ? (
                <Image
                  src={logo}
                  alt={`${activeItem.title} logo`}
                  width={activeItem.logo_width ?? 500}
                  height={activeItem.logo_height ?? 200}
                  priority
                  sizes={logoSizes}
                  className="h-28 w-auto max-w-xs object-contain object-left-bottom sm:h-36 sm:max-w-lg"
                />
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
                <Badge className="bg-accent-red/90 text-white text-xs uppercase tracking-wider hover:bg-accent-red/80">
                  {t("TV Series")}
                </Badge>
              )}
              <div className="flex items-center gap-1.5 text-accent-red font-semibold">
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
                <span className="text-sm font-semibold text-accent-red">
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
                    "rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-8 h-12 text-base cursor-pointer",
                })}
              />
              <Link
                href={localizedHref(locale, detailHref)}
                className={buttonClassName({
                  size: "lg",
                  variant: "outline",
                  className:
                    "rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-foreground gap-2 px-8 h-12 text-base cursor-pointer",
                })}
              >
                <Info className="size-5" />
                {t("Details")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
