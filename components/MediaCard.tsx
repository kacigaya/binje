"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import CardWatchlistToggle from "@/components/CardWatchlistToggle";
import type { MediaItem } from "@/types/tmdb";
import { posterUrl } from "@/lib/tmdb";
import { formatRating, localizedHref } from "@/lib/i18n";
import {
  getPlayHistory,
  getPlaybackProgress,
  subscribeToPlayHistory,
  type PlayHistoryItem,
} from "@/lib/play-history";
import { useTranslations } from "@/lib/use-locale";
import { cn } from "@/lib/utils";

const EMPTY_HISTORY: PlayHistoryItem[] = [];

export default function MediaCard({
  item,
  eager = false,
  className = "w-40 shrink-0 sm:w-46.25",
}: {
  item: MediaItem;
  eager?: boolean;
  /** Width classes; carousels use fixed widths, grids pass `w-full`. */
  className?: string;
}) {
  const { locale, t } = useTranslations();
  const history = useSyncExternalStore(
    subscribeToPlayHistory,
    getPlayHistory,
    () => EMPTY_HISTORY,
  );
  const poster = posterUrl(item.poster_path, "w342");
  const href =
    item.media_type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
  const rating = formatRating(locale, item.vote_average) ?? t("N/A");
  const year = item.date ? new Date(item.date).getFullYear() : null;
  const progress = getPlaybackProgress(
    history.find(
      (entry) => entry.type === item.media_type && entry.id === item.id,
    ),
  );

  return (
    <div className={cn("group relative", className)}>
      <Link
        href={localizedHref(locale, href)}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-card ring-1 ring-white/5 transition-shadow duration-200 group-hover:ring-white/25">
          <Image
            src={poster}
            alt=""
            fill
            priority={eager}
            loading={eager ? "eager" : "lazy"}
            className="object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes="(max-width: 640px) 160px, 185px"
          />

          {/* Decorative: the Continue Watching row carries the same progress
              with readable timings. */}
          {progress !== null && (
            <div
              aria-hidden="true"
              className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25"
            >
              <div
                className="h-full rounded-full bg-accent-red"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>

        <p className="mt-2 truncate text-sm font-semibold leading-tight text-foreground">
          {item.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {item.media_type === "tv" && (
            <>
              <span>{t("TV Series")}</span>
              {year && <span aria-hidden="true">·</span>}
            </>
          )}
          {year && <span>{year}</span>}
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Star
              aria-hidden="true"
              className="size-3 fill-rating text-rating"
            />
            {rating}
          </span>
        </p>
      </Link>

      <CardWatchlistToggle
        item={{
          type: item.media_type,
          id: item.id,
          title: item.title,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          date: item.date,
          vote_average: item.vote_average,
        }}
        className="absolute right-2 top-2"
      />
    </div>
  );
}
