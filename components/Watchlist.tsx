"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Star, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import {
  getWatchlist,
  getWatchlistHref,
  removeFromWatchlist,
  subscribeToWatchlist,
  type WatchlistItem,
} from "@/lib/watchlist";
import { posterUrl } from "@/lib/tmdb";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";

const EMPTY_WATCHLIST: WatchlistItem[] = [];

export default function Watchlist() {
  const { locale, t } = useTranslations();
  const items = useSyncExternalStore(
    subscribeToWatchlist,
    getWatchlist,
    () => EMPTY_WATCHLIST,
  );

  function removeItem(event: MouseEvent<HTMLButtonElement>, item: WatchlistItem) {
    event.preventDefault();
    event.stopPropagation();
    removeFromWatchlist(item);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-card/40 px-6 py-20 text-center">
        <Bookmark className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">{t("Your watchlist is empty")}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("Browse movies and TV shows, then tap")}{" "}
          <span className="font-medium text-foreground">{t("Add to Watchlist")}</span>{" "}
          {t("to save them here for later.")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const poster = posterUrl(item.poster_path, "w342");
        const rating = Number.isFinite(item.vote_average)
          ? item.vote_average.toFixed(1)
          : t("N/A");

        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={localizedHref(locale, getWatchlistHref(item))}
            className="group block"
          >
            <div className="relative overflow-hidden rounded-xl bg-card transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_0_30px_rgba(225,29,72,0.15)]">
              <div className="relative aspect-2/3 overflow-hidden rounded-xl">
                <Image
                  src={poster}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 185px"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent" />

                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-accent-red">
                  <Star className="h-3 w-3 fill-accent-red" />
                  {rating}
                </div>

                <div className="absolute top-2 left-2 rounded-full bg-accent-red/90 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  {t(item.type === "tv" ? "TV" : "Movie")}
                </div>

                <button
                  type="button"
                  onClick={(event) => removeItem(event, item)}
                  aria-label={`${t("Remove from watchlist")}: ${item.title}`}
                  className="absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/85 backdrop-blur-sm transition-colors hover:bg-accent-red hover:text-white focus:outline-none focus:ring-2 focus:ring-accent-red/70"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-3 pr-11">
                  <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                    {item.title}
                  </p>
                  {item.date && (
                    <p className="mt-1 text-xs text-white/65">
                      {new Date(item.date).getFullYear()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
