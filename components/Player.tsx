"use client";

import { useEffect, useMemo, useRef } from "react";
import { updatePlayHistoryProgress } from "@/lib/play-history";

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
  const lastSavedAtRef = useRef(0);

  useEffect(() => {
    lastSavedAtRef.current = 0;
  }, [embedUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;

      const data = event.data as {
        source?: unknown;
        event?: unknown;
        type?: unknown;
        id?: unknown;
        season?: unknown;
        episode?: unknown;
        positionSeconds?: unknown;
        durationSeconds?: unknown;
      };

      if (data.source !== "binje-player" || data.event !== "progress") return;
      if (data.type !== type || data.id !== tmdbId) return;
      if (type === "tv") {
        if (data.season !== (season ?? 1) || data.episode !== (episode ?? 1)) {
          return;
        }
      }
      if (
        typeof data.positionSeconds !== "number" ||
        typeof data.durationSeconds !== "number"
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastSavedAtRef.current < 5000) return;
      lastSavedAtRef.current = now;

      updatePlayHistoryProgress({
        type,
        id: tmdbId,
        season,
        episode,
        positionSeconds: data.positionSeconds,
        durationSeconds: data.durationSeconds,
      });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
