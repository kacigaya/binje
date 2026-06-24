"use client";

import { useEffect, useMemo, useRef } from "react";
import { updatePlayHistoryProgress } from "@/lib/play-history";

const PLAYER_ORIGIN = "https://vidlink.pro";
const ACCENT = "e11d48";

export type PlayerMediaType = "movie" | "tv";
type VidlinkProgress = { watched?: unknown; duration?: unknown };
type VidlinkEntry = {
  progress?: VidlinkProgress;
  show_progress?: Record<string, { progress?: VidlinkProgress }>;
};

function getVidlinkUrl({
  id,
  type,
  season,
  episode,
}: {
  id: number;
  type: PlayerMediaType;
  season?: number;
  episode?: number;
}) {
  const path =
    type === "tv" ? `/tv/${id}/${season ?? 1}/${episode ?? 1}` : `/movie/${id}`;

  const url = new URL(path, PLAYER_ORIGIN);
  url.searchParams.set("primaryColor", ACCENT);
  url.searchParams.set("secondaryColor", "ffffff");
  url.searchParams.set("iconColor", "ffffff");
  url.searchParams.set("title", "true");
  url.searchParams.set("poster", "true");
  url.searchParams.set("autoplay", "false");
  url.searchParams.set("nextbutton", "true");
  url.searchParams.set("player", "jw");

  return url.toString();
}

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
}: {
  tmdbId: number;
  type?: PlayerMediaType;
  season?: number;
  episode?: number;
}) {
  const embedUrl = useMemo(
    () =>
      `/api/vidlink?url=${encodeURIComponent(
        getVidlinkUrl({ id: tmdbId, type, season, episode }),
      )}`,
    [episode, season, tmdbId, type],
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSavedAtRef = useRef(0);

  useEffect(() => {
    lastSavedAtRef.current = 0;
  }, [embedUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== PLAYER_ORIGIN &&
        event.source !== iframeRef.current?.contentWindow
      ) {
        return;
      }
      if (!event.data || typeof event.data !== "object") return;

      const message = event.data as { type?: unknown; data?: unknown };
      if (message.type !== "MEDIA_DATA" || !message.data) return;

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
        ref={iframeRef}
        key={embedUrl}
        src={embedUrl}
        title="Video player"
        className="absolute inset-0 h-full w-full border-0 bg-black"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="origin"
      />
    </div>
  );
}
