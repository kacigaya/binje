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
            {logo ? (
              <Image
                src={logo}
                alt={`${activeItem.title} logo`}
                width={activeItem.logo_width ?? 500}
                height={activeItem.logo_height ?? 200}
                priority
                className="h-auto max-h-28 w-auto max-w-xs object-contain sm:max-h-36 sm:max-w-lg"
              />
            ) : (
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none text-balance"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {activeItem.title}
              </h1>
            )}

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
