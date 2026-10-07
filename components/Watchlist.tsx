"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Star } from "lucide-react";
import RemoveButton from "@/components/RemoveButton";
import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  getWatchlist,
  getWatchlistHref,
  removeFromWatchlist,
  saveWatchlist,
  subscribeToWatchlist,
  type WatchlistItem,
} from "@/lib/watchlist";
import { posterUrl } from "@/lib/tmdb";
import { formatRating, localizedHref } from "@/lib/i18n";
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
    const previous = getWatchlist();
    removeFromWatchlist(item);
    toast.success(t("Removed from watchlist"), {
      description: item.title,
      action: { label: t("Undo"), onClick: () => saveWatchlist(previous) },
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-card/40 px-6 py-20 text-center">
        <Bookmark aria-hidden="true" className="size-10 text-muted-foreground" />
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
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const poster = posterUrl(item.poster_path, "w342");
        const rating = formatRating(locale, item.vote_average) ?? t("N/A");
        const year = item.date ? new Date(item.date).getFullYear() : null;

        return (
          <div key={`${item.type}-${item.id}`} className="group relative min-w-0">
            <Link
              href={localizedHref(locale, getWatchlistHref(item))}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-card ring-1 ring-white/5 transition-shadow duration-200 group-hover:ring-white/25">
                <Image
                  src={poster}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 185px"
                />
              </div>

              <p className="mt-2 truncate text-sm font-semibold leading-tight text-foreground">
                {item.title}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                {item.type === "tv" && (
                  <>
                    <span>{t("TV Series")}</span>
                    {year && <span aria-hidden="true">·</span>}
                  </>
                )}
                {year && <span>{year}</span>}
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Star aria-hidden="true" className="size-3 fill-rating text-rating" />
                  {rating}
                </span>
              </p>
            </Link>
            {/* Always visible: removing is this page's main action, unlike
                the hover-revealed add toggle on browse cards. */}
            <RemoveButton
              onClick={(event) => removeItem(event, item)}
              label={`${t("Remove from watchlist")}: ${item.title}`}
              iconSize={16}
              className="absolute right-2 top-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/65 text-white transition-colors hover:bg-accent-red hover:border-accent-red/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
            />
          </div>
        );
      })}
    </div>
  );
}
