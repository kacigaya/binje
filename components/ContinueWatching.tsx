"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import {
  getPlayHistory,
  getPlayHistoryHref,
  removePlayHistoryItem,
  subscribeToPlayHistory,
  type PlayHistoryItem,
} from "@/lib/play-history";
import { posterUrl } from "@/lib/tmdb";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";

const EMPTY_HISTORY: PlayHistoryItem[] = [];

export default function ContinueWatching() {
  const items = useSyncExternalStore(
    subscribeToPlayHistory,
    getPlayHistory,
    () => EMPTY_HISTORY,
  );
  const { scrollRef, canScrollLeft, canScrollRight } =
    useHorizontalScroll(items);

  function removeItem(event: MouseEvent<HTMLButtonElement>, item: PlayHistoryItem) {
    event.preventDefault();
    event.stopPropagation();
    removePlayHistoryItem(item);
  }

  if (items.length === 0) return null;

  return (
    <section className="relative">
      <h2
        className="text-xl sm:text-2xl font-bold tracking-tight mb-4 px-4 sm:px-6"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Continue Watching
      </h2>

      <div className="relative">
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 py-2"
        >
          {items.map((item) => {
            const poster = posterUrl(item.poster_path, "w342");
            const rating = Number.isFinite(item.vote_average)
              ? item.vote_average.toFixed(1)
              : "N/A";
            const progress =
              typeof item.progress === "number" &&
              Number.isFinite(item.progress) &&
              item.progress > 0 &&
              item.progress < 1
                ? item.progress
                : null;

            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={getPlayHistoryHref(item)}
                className="group block shrink-0"
              >
                <div className="relative w-40 sm:w-46.25 overflow-hidden rounded-xl bg-card transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_0_30px_rgba(225,29,72,0.15)]">
                  <div className="relative aspect-2/3 overflow-hidden rounded-xl">
                    <Image
                      src={poster}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 160px, 185px"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent" />

                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-accent-red">
                      <Star className="h-3 w-3 fill-accent-red" />
                      {rating}
                    </div>

                    <div className="absolute top-2 left-2 rounded-full bg-accent-red/90 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      {item.type === "tv" ? "TV" : "Movie"}
                    </div>

                    <button
                      type="button"
                      onClick={(event) => removeItem(event, item)}
                      aria-label={`Remove ${item.title} from history`}
                      className="absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/85 backdrop-blur-sm transition-colors hover:bg-accent-red hover:text-white focus:outline-none focus:ring-2 focus:ring-accent-red/70"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="absolute bottom-0 left-0 right-0 p-3 pr-11">
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/65">
                        {item.date && (
                          <span>{new Date(item.date).getFullYear()}</span>
                        )}
                        {item.type === "tv" && item.season && item.episode && (
                          <span>
                            S{item.season} E{item.episode}
                          </span>
                        )}
                      </div>
                    </div>

                    {progress !== null && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-accent-red"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
