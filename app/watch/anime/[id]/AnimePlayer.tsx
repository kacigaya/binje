"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Player from "@/components/Player";

export interface AnimeEpisode {
  number: number;
  title: string | null;
  filler?: boolean;
}

export default function AnimePlayer({
  malId,
  episodeCount,
  episodes,
  episode: initialEpisode,
  dub: initialDub,
}: {
  malId: number;
  episodeCount: number;
  episodes: AnimeEpisode[];
  episode: number;
  dub: boolean;
}) {
  const router = useRouter();
  const [episode, setEpisode] = useState(initialEpisode);
  const [dub, setDub] = useState(initialDub);

  const titleByNumber = new Map(episodes.map((ep) => [ep.number, ep.title]));
  const total = Math.max(episodeCount, episodes.length, episode, 1);
  const list: AnimeEpisode[] = Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    title: titleByNumber.get(i + 1) ?? null,
  }));

  const navigate = useCallback(
    (nextEpisode: number, nextDub: boolean) => {
      setEpisode(nextEpisode);
      setDub(nextDub);
      const dubParam = nextDub ? "&dub=1" : "";
      router.replace(`/watch/anime/${malId}?e=${nextEpisode}${dubParam}`, {
        scroll: false,
      });
    },
    [malId, router],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [episode]);

  const hasPrev = episode > 1;
  const hasNext = episode < total;

  return (
    <div className="space-y-4">
      <Player
        tmdbId={malId}
        title=""
        type="anime"
        episode={episode}
        dub={dub}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-0">
        {/* Sub / Dub toggle */}
        <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
          {(["sub", "dub"] as const).map((mode) => {
            const isDub = mode === "dub";
            const active = dub === isDub;
            return (
              <button
                key={mode}
                onClick={() => navigate(episode, isDub)}
                className={`px-4 h-8 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  active
                    ? "bg-accent-red text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Now playing:{" "}
          <span className="text-foreground font-medium">
            Episode {episode}
            {titleByNumber.get(episode) ? ` — ${titleByNumber.get(episode)}` : ""}
          </span>
        </p>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={() => navigate(episode - 1, dub)}
            disabled={!hasPrev}
            className="flex items-center gap-1 h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={() => navigate(episode + 1, dub)}
            disabled={!hasNext}
            className="flex items-center gap-1 h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Episode grid */}
      <div className="px-4 sm:px-0">
        <h3
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Episodes
        </h3>
        <div
          ref={scrollRef}
          className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto scrollbar-hide pb-2"
          style={{ gridTemplateRows: "repeat(2, minmax(0, 1fr))" }}
        >
          {list.map((ep) => {
            const active = ep.number === episode;
            return (
              <button
                key={ep.number}
                ref={active ? activeRef : undefined}
                onClick={() => navigate(ep.number, dub)}
                title={ep.title ?? `Episode ${ep.number}`}
                className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-accent-red text-white"
                    : "bg-white/5 text-foreground hover:bg-white/10"
                }`}
              >
                {ep.number}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
