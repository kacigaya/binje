"use client";

import { useMemo } from "react";

function getVideasyUrl({
  tmdbId,
  type,
  season,
  episode,
}: {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  const path =
    type === "tv"
      ? `/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`
      : `/movie/${tmdbId}`;
  const url = new URL(path, "https://player.videasy.net");

  url.searchParams.set("color", "e11d48");
  url.searchParams.set("overlay", "true");

  if (type === "tv") {
    url.searchParams.set("nextEpisode", "true");
    url.searchParams.set("episodeSelector", "true");
  }

  return url.toString();
}

export default function Player({
  tmdbId,
  type = "movie",
  season,
  episode,
}: {
  tmdbId: number;
  title: string;
  year?: number;
  imdbId?: string;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  const embedUrl = useMemo(() => {
    const playerUrl = getVideasyUrl({ tmdbId, type, season, episode });
    return `/api/embed?url=${encodeURIComponent(playerUrl)}`;
  }, [episode, season, tmdbId, type]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <iframe
        key={embedUrl}
        src={embedUrl}
        title="Video player"
        className="absolute inset-0 h-full w-full border-0 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="origin"
      />
    </div>
  );
}
