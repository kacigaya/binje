"use client";

import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { fetchResolve } from "@/lib/resolve-client";
import { updatePlayHistoryProgress } from "@/lib/play-history";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

export type PlayerMediaType = "movie" | "tv";
type Track = { file: string; label?: string };
type Quality = { index: number; height: number; bitrate: number };
type StreamSource = { file: string; height: number };

type Lang = "en" | "vf";
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "VO" },
  { id: "vf", label: "VF" },
];

export const RESOLVE_BASE = (process.env.NEXT_PUBLIC_RESOLVE_BASE || "/api").replace(/\/+$/, "");

export function proxied(url: string) {
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

function createMasterPlaylist(sources: StreamSource[]) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const source of sources) {
    const width = Math.round((source.height * 16) / 9 / 2) * 2;
    const bandwidth = Math.round(source.height * source.height * 5);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${source.height}`,
      new URL(proxied(source.file), window.location.origin).href,
    );
  }
  return `${lines.join("\n")}\n`;
}

export default function Player({
  tmdbId,
  title,
  year,
  imdbId = "",
  type = "movie",
  season,
  episode,
}: {
  tmdbId: number;
  title: string;
  year: string;
  imdbId?: string | null;
  type?: PlayerMediaType;
  season?: number;
  episode?: number;
}) {
  const { t } = useTranslations();
  const [lang, setLang] = useState<Lang>("en");

  const sourceUrl = useMemo(() => {
    const params = new URLSearchParams({
      type,
      id: String(tmdbId),
      title,
      year,
      imdbId: imdbId ?? "",
    });
    if (type === "tv") {
      params.set("season", String(season ?? 1));
      params.set("episode", String(episode ?? 1));
    }
    const endpoint = lang === "vf" ? "resolve-vf" : "resolve";
    return `${RESOLVE_BASE}/${endpoint}?${params.toString()}`;
  }, [episode, imdbId, lang, season, title, tmdbId, type, year]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAtRef = useRef(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(-1);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    setLoading(true);
    setTracks([]);
    setQualities([]);
    setQuality(-1);
    lastSavedAtRef.current = 0;

    let hls: Hls | null = null;
    let masterUrl: string | null = null;

    (async () => {
      try {
        const data = await fetchResolve(sourceUrl);
        if (cancelled) return;

        setTracks((data.tracks ?? []).filter((t) => t.file));
        const hlsSupported = Hls.isSupported();
        if (hlsSupported && data.sources?.length) {
          masterUrl = URL.createObjectURL(
            new Blob([createMasterPlaylist(data.sources)], {
              type: "application/vnd.apple.mpegurl",
            }),
          );
        }
        const src = masterUrl ?? proxied(data.url);

        if (hlsSupported) {
          hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            const byHeight = new Map<number, Quality>();
            data.levels.forEach((level, index) => {
              if (!level.height) return;
              const current = byHeight.get(level.height);
              if (!current || level.bitrate > current.bitrate) {
                byHeight.set(level.height, {
                  index,
                  height: level.height,
                  bitrate: level.bitrate,
                });
              }
            });
            setQualities([...byHeight.values()].sort((a, b) => b.height - a.height));
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, payload) => {
            if (payload.fatal) setError(true);
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
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
      if (hlsRef.current === hls) hlsRef.current = null;
      hls?.destroy();
      if (masterUrl) URL.revokeObjectURL(masterUrl);
    };
  }, [sourceUrl]);

  function changeQuality(index: number) {
    setQuality(index);
    if (hlsRef.current) hlsRef.current.nextLevel = index;
  }

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
      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-full border border-white/15 bg-black/50 p-1 backdrop-blur">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLang(l.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-red/60",
              lang === l.id
                ? "bg-accent-red text-white"
                : "text-white/70 hover:text-white hover:bg-white/10",
            )}
          >
            {l.label}
          </button>
        ))}
        {qualities.length > 0 && (
          <Select
            ariaLabel={t("Quality")}
            value={quality}
            onValueChange={changeQuality}
            items={[
              { value: -1, label: t("Auto") },
              ...qualities.map((item) => ({
                value: item.index,
                label: `${item.height}p`,
              })),
            ]}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white tabular-nums"
          />
        )}
      </div>
      <video
        ref={videoRef}
        controls
        playsInline
        onTimeUpdate={onTimeUpdate}
        className="absolute inset-0 h-full w-full rounded-xl bg-black"
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
          {error
            ? lang === "vf"
              ? t("No VF stream for this title.")
              : t("Stream unavailable. Try again later.")
            : t("Loading…")}
        </div>
      )}
    </div>
  );
}
