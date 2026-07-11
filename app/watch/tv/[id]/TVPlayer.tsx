"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Clock,
} from "lucide-react";
import Player from "@/components/Player";
import { Button } from "@/components/ui/button";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import { stillUrl } from "@/lib/tmdb";
import type { Episode } from "@/types/tmdb";

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

export default function TVPlayer({
  showId,
  season: initialSeason,
  episode: initialEpisode,
  seasons,
  initialEpisodes,
}: {
  showId: number;
  season: number;
  episode: number;
  seasons: SeasonInfo[];
  initialEpisodes: Episode[];
}) {
  const router = useRouter();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes);
  // Season the cached `episodes` belong to; drives the loading state.
  const [episodesSeason, setEpisodesSeason] = useState(initialSeason);

  const currentSeason = seasons.find((s) => s.season_number === season);
  const maxEpisodes = currentSeason?.episode_count ?? 1;
  const loading = episodesSeason !== season;

  useEffect(() => {
    if (episodesSeason === season) return;

    let cancelled = false;
    fetch(`/api/episodes?showId=${showId}&season=${season}`)
      .then((res) => (res.ok ? res.json() : { episodes: [] }))
      .then((data) => {
        if (cancelled) return;
        setEpisodes(data.episodes ?? []);
        setEpisodesSeason(season);
      })
      .catch(() => {
        if (cancelled) return;
        setEpisodes([]);
        setEpisodesSeason(season);
      });

    return () => {
      cancelled = true;
    };
  }, [season, showId, episodesSeason]);

  const {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    scroll: scrollEpisodes,
  } = useHorizontalScroll(`${episodesSeason}:${episodes.length}:${loading}`);

  function navigate(s: number, e: number) {
    setSeason(s);
    setEpisode(e);
    router.replace(`/watch/tv/${showId}?s=${s}&e=${e}`, { scroll: false });
  }

  function prevEpisode() {
    if (episode > 1) {
      navigate(season, episode - 1);
    } else {
      const prevSeason = seasons.find((s) => s.season_number === season - 1);
      if (prevSeason) {
        navigate(prevSeason.season_number, prevSeason.episode_count);
      }
    }
  }

  function nextEpisode() {
    if (episode < maxEpisodes) {
      navigate(season, episode + 1);
    } else {
      const nextSeason = seasons.find((s) => s.season_number === season + 1);
      if (nextSeason) {
        navigate(nextSeason.season_number, 1);
      }
    }
  }

  const hasPrev =
    episode > 1 || seasons.some((s) => s.season_number === season - 1);
  const hasNext =
    episode < maxEpisodes ||
    seasons.some((s) => s.season_number === season + 1);

  return (
    <div className="space-y-4">
      <Player tmdbId={showId} type="tv" season={season} episode={episode} />

      {/* Controls */}
      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:px-0">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <label
            htmlFor="season-select"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Season
          </label>
          <div className="relative">
            <select
              id="season-select"
              value={season}
              onChange={(e) => navigate(Number(e.target.value), 1)}
              className="h-10 appearance-none rounded-full border border-white/15 bg-white/5 pl-4 pr-10 text-sm font-medium text-foreground outline-none transition-colors hover:bg-white/10 focus-visible:border-accent-red/50 focus-visible:ring-2 focus-visible:ring-accent-red/30 cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s.season_number} value={s.season_number}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
          </div>
        </div>

        <div className="flex min-w-0 items-center sm:border-l sm:border-white/10 sm:pl-4">
          <p className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Now playing
            </span>
            <span
              className="block truncate text-sm font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {currentSeason?.name ?? `Season ${season}`}, Episode {episode}
            </span>
          </p>
        </div>

        {/* Prev/Next buttons */}
        <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={prevEpisode}
            disabled={!hasPrev}
            className="h-10 rounded-full px-4 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={nextEpisode}
            disabled={!hasNext}
            className="h-10 rounded-full px-4 cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Episode previews */}
      <div className="px-4 sm:px-0">
        <h3
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Episodes
        </h3>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pt-1 pl-1 pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-72 sm:w-80 shrink-0 aspect-video rounded-2xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No episode previews available.
          </p>
        ) : (
          <div className="group/episodes relative">
            {canScrollLeft && (
              <>
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
                <button
                  type="button"
                  onClick={() => scrollEpisodes("left")}
                  aria-label="Scroll left"
                  className="absolute left-0 top-0 bottom-0 z-20 flex w-12 items-center justify-center opacity-0 group-hover/episodes:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronLeft className="h-8 w-8 text-foreground" />
                </button>
              </>
            )}
            {canScrollRight && (
              <>
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
                <button
                  type="button"
                  onClick={() => scrollEpisodes("right")}
                  aria-label="Scroll right"
                  className="absolute right-0 top-0 bottom-0 z-20 flex w-12 items-center justify-center opacity-0 group-hover/episodes:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronRight className="h-8 w-8 text-foreground" />
                </button>
              </>
            )}

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide pt-1 pl-1 pb-2"
            >
              {episodes.map((ep) => {
              const still = stillUrl(ep.still_path, "w300");
              const isActive = ep.episode_number === episode;
              return (
                <button
                  key={ep.id}
                  onClick={() => navigate(season, ep.episode_number)}
                  className={`group relative w-72 sm:w-80 shrink-0 text-left aspect-video rounded-2xl overflow-hidden ring-1 transition-all cursor-pointer ${
                    isActive
                      ? "ring-2 ring-white shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
                      : "ring-white/10 hover:ring-white/30"
                  }`}
                >
                  {still ? (
                    <Image
                      src={still}
                      alt={ep.name}
                      fill
                      loading="lazy"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="320px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-card text-muted-foreground text-xs">
                      No preview
                    </div>
                  )}

                  {/* Bottom gradient scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity group-hover:opacity-0" />

                  {/* Hover play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-9 w-9 text-white fill-white" />
                  </div>

                  {/* Overlaid content */}
                  <div className="absolute inset-x-0 bottom-0 p-3.5 space-y-1 transition-opacity group-hover:opacity-0">
                    <p className="text-sm font-semibold leading-snug text-white line-clamp-2">
                      {isActive && (
                        <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-accent-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider align-middle">
                          Watching
                        </span>
                      )}
                      {ep.episode_number}. {ep.name}
                    </p>
                    {ep.runtime ? (
                      <span className="flex items-center gap-1 text-[11px] text-white/60">
                        <Clock className="h-3 w-3" />
                        {ep.runtime}m
                      </span>
                    ) : null}
                    {ep.overview ? (
                      <p className="text-[11px] leading-snug text-white/50 line-clamp-2">
                        {ep.overview}
                      </p>
                    ) : null}
                  </div>

                  {/* Active progress accent */}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-accent-red transition-opacity group-hover:opacity-0" />
                  )}
                </button>
              );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
