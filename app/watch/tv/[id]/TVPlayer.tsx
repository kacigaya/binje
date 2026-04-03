"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Player from "@/components/Player";

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
}: {
  showId: number;
  season: number;
  episode: number;
  seasons: SeasonInfo[];
}) {
  const router = useRouter();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  const currentSeason = seasons.find((s) => s.season_number === season);
  const maxEpisodes = currentSeason?.episode_count ?? 1;

  function navigate(s: number, e: number) {
    setSeason(s);
    setEpisode(e);
    router.replace(`/watch/tv/${showId}?s=${s}&e=${e}`, { scroll: false });
  }

  function prevEpisode() {
    if (episode > 1) {
      navigate(season, episode - 1);
    } else {
      const prevSeason = seasons.find(
        (s) => s.season_number === season - 1
      );
      if (prevSeason) {
        navigate(prevSeason.season_number, prevSeason.episode_count);
      }
    }
  }

  function nextEpisode() {
    if (episode < maxEpisodes) {
      navigate(season, episode + 1);
    } else {
      const nextSeason = seasons.find(
        (s) => s.season_number === season + 1
      );
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-0">
        {/* Season/Episode selectors */}
        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Episode</label>
            <select
              value={episode}
              onChange={(e) => navigate(season, Number(e.target.value))}
              className="h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 cursor-pointer"
            >
              {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map(
                (ep) => (
                  <option key={ep} value={ep}>
                    Episode {ep}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

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

      {/* Now playing label */}
      <div className="px-4 sm:px-0">
        <p className="text-sm text-muted-foreground">
          Now playing:{" "}
          <span className="text-foreground font-medium">
            {currentSeason?.name ?? `Season ${season}`} — Episode {episode}
          </span>
        </p>
      </div>
    </div>
  );
}
