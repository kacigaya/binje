"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { localizedHref } from "@/lib/i18n";
import {
  getPlayHistory,
  getPlaybackProgress,
  subscribeToPlayHistory,
  type PlayHistoryItem,
} from "@/lib/play-history";
import { stillUrl } from "@/lib/tmdb";
import { useTranslations } from "@/lib/use-locale";
import type { Episode } from "@/types/tmdb";

type SeasonInfo = { season_number: number; name: string; episode_count: number };

const EMPTY_HISTORY: PlayHistoryItem[] = [];

/**
 * Season picker and episode list on the show page, so an episode can be
 * chosen without going through the player first. Opens on the season the
 * viewer last watched, when local history has one.
 */
export default function SeasonEpisodes({
  showId,
  seasons,
  initialSeason,
  initialEpisodes,
}: {
  showId: number;
  seasons: SeasonInfo[];
  initialSeason: number;
  initialEpisodes: Episode[];
}) {
  const { locale, t } = useTranslations();
  const history = useSyncExternalStore(
    subscribeToPlayHistory,
    getPlayHistory,
    () => EMPTY_HISTORY,
  );
  const last = history.find((item) => item.type === "tv" && item.id === showId);
  const lastSeason =
    last?.season && seasons.some((s) => s.season_number === last.season)
      ? last.season
      : undefined;

  const [picked, setPicked] = useState<number | null>(null);
  const season = picked ?? lastSeason ?? initialSeason;
  const [episodesBySeason, setEpisodesBySeason] = useState<
    Record<number, Episode[] | null>
  >({ [initialSeason]: initialEpisodes });
  const episodes = episodesBySeason[season];

  useEffect(() => {
    if (episodesBySeason[season] !== undefined) return;
    let cancelled = false;
    fetch(`/api/episodes?showId=${showId}&season=${season}&lang=${locale}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("episodes"))))
      .then((data: { episodes?: Episode[] }) => {
        if (!cancelled) {
          setEpisodesBySeason((prev) => ({ ...prev, [season]: data.episodes ?? [] }));
        }
      })
      .catch(() => {
        if (!cancelled) setEpisodesBySeason((prev) => ({ ...prev, [season]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [episodesBySeason, locale, season, showId]);

  const progress =
    last && last.season === season ? getPlaybackProgress(last) : null;

  return (
    <section className="mt-12" aria-labelledby="episodes-heading">
      <h2
        id="episodes-heading"
        className="mb-4 text-xl font-bold"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {t("Episodes")}
      </h2>

      <div
        role="group"
        aria-label={t("Season")}
        className="mb-4 flex flex-wrap gap-2"
      >
        {seasons.map((s) => {
          const active = s.season_number === season;
          return (
            <button
              key={s.season_number}
              type="button"
              aria-pressed={active}
              onClick={() => setPicked(s.season_number)}
              className={cn(
                "h-8 cursor-pointer rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-white/15 text-foreground/80 hover:bg-white/10",
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {episodes === undefined ? (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none sm:h-24" />
          ))}
        </ul>
      ) : episodes === null ? (
        <p className="text-sm text-muted-foreground">
          {t("We couldn’t load the content. This might be temporary. Please try again.")}
        </p>
      ) : episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("No episode previews available.")}
        </p>
      ) : (
        <ol className="-mx-2 space-y-1">
          {episodes.map((ep) => {
            const still = stillUrl(ep.still_path, "w300");
            const isLast = last?.season === season && last.episode === ep.episode_number;
            return (
              <li key={ep.id}>
                <Link
                  href={localizedHref(locale, `/watch/tv/${showId}?s=${season}&e=${ep.episode_number}`)}
                  aria-current={isLast ? "true" : undefined}
                  className={cn(
                    "group grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:gap-4",
                    isLast && "bg-white/5",
                  )}
                >
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
                    {still ? (
                      <Image
                        src={still}
                        alt=""
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="160px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {t("No preview")}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play aria-hidden="true" className="size-6 fill-white text-white" />
                    </div>
                    {isLast && progress !== null && (
                      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                        <div
                          className="h-full bg-accent-red"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-snug">
                      <span>
                        {ep.episode_number}. {ep.name}
                      </span>
                      {isLast && (
                        <span className="rounded-full border border-accent-red/50 px-2 text-xs font-semibold text-foreground">
                          {t("Continue")}
                        </span>
                      )}
                    </p>
                    {ep.overview && (
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {ep.overview}
                      </p>
                    )}
                  </div>

                  {ep.runtime ? (
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground tabular-nums sm:flex">
                      <Clock aria-hidden="true" className="size-3.5" />
                      {ep.runtime}m
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
