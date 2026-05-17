"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, Clock } from "lucide-react";
import Player from "@/components/Player";
import { stillUrl } from "@/lib/tmdb";
import type { Episode } from "@/types/tmdb";

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

export default function TVPlayer({
  showId,
  title,
  year,
  season: initialSeason,
  episode: initialEpisode,
  seasons,
  initialEpisodes,
}: {
  showId: number;
  title: string;
  year?: number;
  season: number;
  episode: number;
  seasons: SeasonInfo[];
  initialEpisodes: Episode[];
}) {
  const router = useRouter();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes);
  // Season the cached `episodes` belong to — drives the loading state.
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
      <Player
        tmdbId={showId}
        title={title}
        year={year}
        type="tv"
        season={season}
        episode={episode}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-0">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Season</label>
          <select
            value={season}
            onChange={(e) => navigate(Number(e.target.value), 1)}
            className="h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 cursor-pointer"
          >
            {seasons.map((s) => (
              <option key={s.season_number} value={s.season_number}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-muted-foreground">
          Now playing:{" "}
          <span className="text-foreground font-medium">
            {currentSeason?.name ?? `Season ${season}`} — Episode {episode}
          </span>
        </p>

        {/* Prev/Next buttons */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={prevEpisode}
            disabled={!hasPrev}
            className="flex items-center gap-1 h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={nextEpisode}
            disabled={!hasNext}
            className="flex items-center gap-1 h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
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
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-44 sm:w-52 shrink-0 aspect-video rounded-lg bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No episode previews available.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {episodes.map((ep) => {
              const still = stillUrl(ep.still_path, "w300");
              const isActive = ep.episode_number === episode;
              return (
                <button
                  key={ep.id}
                  onClick={() => navigate(season, ep.episode_number)}
                  className={`group w-44 sm:w-52 shrink-0 text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                    isActive
                      ? "border-accent-red bg-accent-red/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="relative aspect-video bg-card overflow-hidden">
                    {still ? (
                      <Image
                        src={still}
                        alt={ep.name}
                        fill
                        loading="lazy"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="208px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                        No preview
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                    {isActive && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-accent-red px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        Playing
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-semibold line-clamp-1">
                      E{ep.episode_number} · {ep.name}
                    </p>
                    {ep.runtime ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {ep.runtime}m
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
