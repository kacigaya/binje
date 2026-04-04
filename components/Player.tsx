"use client";

import { ExternalLink, ShieldBan } from "lucide-react";

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

  const wrapperSrc = `/api/embed/player?src=${encodeURIComponent(src)}`;

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <iframe
          key={wrapperSrc}
          src={wrapperSrc}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          sandbox="allow-same-origin allow-scripts allow-forms allow-presentation"
          referrerPolicy="no-referrer"
          title="Player"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ShieldBan className="h-3.5 w-3.5 text-accent-red" />
        <span>Popup attempts are sandbox-blocked in embedded mode.</span>
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
