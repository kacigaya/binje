"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import {
  getPlayHistory,
  getPlayHistoryHref,
  removePlayHistoryItem,
  subscribeToPlayHistory,
  type PlayHistoryItem,
} from "@/lib/play-history";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";

const EMPTY_HISTORY: PlayHistoryItem[] = [];

export default function ContinueWatching() {
  const { locale, t } = useTranslations();
  const items = useSyncExternalStore(
    subscribeToPlayHistory,
    getPlayHistory,
    () => EMPTY_HISTORY,
  );
  const { scrollRef, canScrollLeft, canScrollRight, scroll } =
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
        {t("Continue Watching")}
      </h2>

      <div className="group/carousel relative">
        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
              aria-label={t("Scroll left")}
            >
              <ChevronLeft className="size-8 text-foreground" />
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
              aria-label={t("Scroll right")}
            >
              <ChevronRight className="size-8 text-foreground" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 py-2"
        >
          {items.map((item) => {
            const image = item.backdrop_path
              ? backdropUrl(item.backdrop_path, "w780")
              : posterUrl(item.poster_path, "w342");
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
                href={localizedHref(locale, getPlayHistoryHref(item))}
                className="group block w-56 sm:w-64 shrink-0"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-card transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-1 group-hover:ring-white/25">
                  {image && (
                    <Image
                      src={image}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 224px, 256px"
                    />
                  )}

                  {item.type === "tv" && item.season && item.episode && (
                    <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-white">
                      S{item.season}E{item.episode}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(event) => removeItem(event, item)}
                    aria-label={`${t("Remove from continue watching")}: ${item.title}`}
                    className="absolute right-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/70"
                  >
                    <X className="size-3.5" />
                  </button>

                  {progress !== null && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-accent-red"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground leading-tight truncate">
                  {item.title}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
