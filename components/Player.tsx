"use client";

import { useEffect, useMemo, useRef } from "react";
import { updatePlayHistoryProgress } from "@/lib/play-history";

const PLAYER_ORIGIN = "https://vidlink.pro";
const ACCENT = "e11d48";

export type PlayerMediaType = "movie" | "tv" | "anime";

function getVidlinkUrl({
  id,
  type,
  season,
  episode,
  dub,
}: {
  id: number;
  type: PlayerMediaType;
  season?: number;
  episode?: number;
  dub?: boolean;
}) {
  let path: string;
  if (type === "tv") {
    path = `/tv/${id}/${season ?? 1}/${episode ?? 1}`;
  } else if (type === "anime") {
    path = `/anime/${id}/${episode ?? 1}/${dub ? "dub" : "sub"}`;
  } else {
    path = `/movie/${id}`;
  }

  const url = new URL(path, PLAYER_ORIGIN);
  url.searchParams.set("primaryColor", ACCENT);
  url.searchParams.set("secondaryColor", "ffffff");
  url.searchParams.set("iconColor", "ffffff");
  url.searchParams.set("title", "true");
  url.searchParams.set("poster", "true");
  url.searchParams.set("autoplay", "false");
  if (type !== "anime") url.searchParams.set("nextbutton", "true");

  return url.toString();
}

type VidlinkProgress = { watched?: unknown; duration?: unknown };
type VidlinkEntry = {
  progress?: VidlinkProgress;
  show_progress?: Record<string, { progress?: VidlinkProgress }>;
};

function readProgress(
  entry: VidlinkEntry,
  type: PlayerMediaType,
  season?: number,
  episode?: number,
): { watched: number; duration: number } | null {
  let raw: VidlinkProgress | undefined;
  if (type === "movie") {
    raw = entry.progress;
  } else {
    const key = `s${season ?? 1}e${episode ?? 1}`;
    raw = entry.show_progress?.[key]?.progress ?? entry.progress;
  }
  if (!raw) return null;

  const watched = Number(raw.watched);
  const duration = Number(raw.duration);
  if (
    !Number.isFinite(watched) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }
  return { watched, duration };
}

export default function Player({
  tmdbId,
  type = "movie",
  season,
  episode,
  dub,
}: {
  tmdbId: number;
  title: string;
  year?: number;
  imdbId?: string;
  type?: PlayerMediaType;
  season?: number;
  episode?: number;
  dub?: boolean;
}) {
  // Streams are embedded directly from vidlink.pro: like most free providers it
  // refuses to run inside a sandboxed iframe, so the player lives on its origin.
  const embedUrl = useMemo(
    () => getVidlinkUrl({ id: tmdbId, type, season, episode, dub }),
    [dub, episode, season, tmdbId, type],
  );
  const lastSavedAtRef = useRef(0);

  useEffect(() => {
    lastSavedAtRef.current = 0;
  }, [embedUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== PLAYER_ORIGIN) return;

      // vidlink posts its whole progress map: {type:"MEDIA_DATA",data:{[id]:{...}}}
      const message = event.data as { type?: unknown; data?: unknown };
      if (message?.type !== "MEDIA_DATA" || !message.data) return;

      const map = message.data as Record<string, VidlinkEntry>;
      const entry = map[String(tmdbId)];
      if (!entry || typeof entry !== "object") return;

      const progress = readProgress(entry, type, season, episode);
      if (!progress) return;

      const now = Date.now();
      if (now - lastSavedAtRef.current < 5000) return;
      lastSavedAtRef.current = now;

      updatePlayHistoryProgress({
        type,
        id: tmdbId,
        season,
        episode,
        positionSeconds: progress.watched,
        durationSeconds: progress.duration,
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
