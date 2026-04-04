"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

export default function Player({
  tmdbId,
  type = "movie",
  season,
  episode,
}: {
  tmdbId: number;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  let src: string;
  if (type === "tv" && season !== undefined && episode !== undefined) {
    src = `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
  } else if (type === "tv") {
    src = `https://player.videasy.net/tv/${tmdbId}/1/1`;
  } else {
    src = `https://player.videasy.net/movie/${tmdbId}`;
  }

  const proxiedSrc = `/api/embed/player?src=${encodeURIComponent(src)}`;

  const [iframeEnabled, setIframeEnabled] = useState(false);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <iframe
          key={proxiedSrc}
          src={proxiedSrc}
          className={`absolute inset-0 w-full h-full ${
            iframeEnabled ? "pointer-events-auto" : "pointer-events-none"
          }`}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="origin"
          title="Player"
        />

        {!iframeEnabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-xs">
            <div className="text-center px-4 max-w-md space-y-3">
              <p className="text-sm sm:text-base text-foreground/90">
                Click once to enable the player.
              </p>
              <button
                onClick={() => setIframeEnabled(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent-red text-white text-sm font-medium hover:bg-accent-red/90 transition-colors cursor-pointer"
              >
                Enable Player
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Use a DNS/ad blocker for stronger popup blocking.</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"
        >
          Open direct source
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
