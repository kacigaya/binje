"use client";

import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { updatePlayHistoryProgress } from "@/lib/play-history";

export type PlayerMediaType = "movie" | "tv";
type Track = { file: string; label?: string };

// Resolve runs on the Cloudflare Worker in prod (its egress gets past
// vidfast.pro's Cloudflare; Netlify's IP is blocked there). Defaults to local
// /api for dev. Segment proxy always stays on /api/hls — the stream CDN serves
// Netlify's server-side fetch but blocks the Worker's IP.
const RESOLVE_BASE = (process.env.NEXT_PUBLIC_RESOLVE_BASE || "/api").replace(/\/+$/, "");

function proxied(url: string) {
  return `/api/hls?url=${encodeURIComponent(url)}`;
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
  const sourceUrl = useMemo(() => {
    const params = new URLSearchParams({ type, id: String(tmdbId) });
    if (type === "tv") {
      params.set("season", String(season ?? 1));
      params.set("episode", String(episode ?? 1));
    }
    return `${RESOLVE_BASE}/vidfast?${params.toString()}`;
  }, [episode, season, tmdbId, type]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAtRef = useRef(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    setLoading(true);
    setTracks([]);
    lastSavedAtRef.current = 0;

    let hls: Hls | null = null;

    (async () => {
      try {
        const res = await fetch(sourceUrl);
        if (!res.ok) throw new Error("resolve failed");
        const data = (await res.json()) as { url: string; tracks?: Track[] };
        if (cancelled) return;

        setTracks((data.tracks ?? []).filter((t) => t.file));
        const src = proxied(data.url);

        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, payload) => {
            if (payload.fatal) setError(true);
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src; // Safari native HLS
        } else {
          throw new Error("HLS unsupported");
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [sourceUrl]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const now = Date.now();
    if (now - lastSavedAtRef.current < 5000) return;
    lastSavedAtRef.current = now;

    updatePlayHistoryProgress({
      type,
      id: tmdbId,
      season,
      episode,
      positionSeconds: video.currentTime,
      durationSeconds: video.duration,
    });
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        controls
        playsInline
        onTimeUpdate={onTimeUpdate}
        className="absolute inset-0 h-full w-full bg-black"
        crossOrigin="anonymous"
      >
        {tracks.map((track, i) => (
          <track
            key={track.file}
            kind="subtitles"
            label={track.label ?? `Track ${i + 1}`}
            src={proxied(track.file)}
            default={i === 0}
          />
        ))}
      </video>
      {(loading || error) && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70 pointer-events-none">
          {error ? "Stream unavailable. Try again later." : "Loading…"}
        </div>
      )}
    </div>
  );
}
