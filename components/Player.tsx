"use client";

import type Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import CastControls from "@/components/CastControls";
import { Select } from "@/components/ui/select";
import { fetchResolve } from "@/lib/resolve-client";
import { updatePlayHistoryProgress } from "@/lib/play-history";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

export type PlayerMediaType = "movie" | "tv";
type Track = { file: string; label?: string };
type Quality = { index: number; height: number; bitrate: number };
type StreamSource = { file: string; height: number };
type ResolvedMedia = { url: string; tracks: Track[]; sources: StreamSource[] };

type Lang = "en" | "vf";
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "VO" },
  { id: "vf", label: "VF" },
];

export const RESOLVE_BASE = "/api";

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
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [googleCasting, setGoogleCasting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    setLoading(true);
    setTracks([]);
    setQualities([]);
    setQuality(-1);
    setResolvedMedia(null);
    lastSavedAtRef.current = 0;

    let hls: Hls | null = null;
    let masterUrl: string | null = null;

    const nativeHlsSupported = Boolean(
      video.canPlayType("application/vnd.apple.mpegurl") &&
        "webkitShowPlaybackTargetPicker" in video,
    );
    // hls.js is ~600 KB and Safari never needs it, so it lives in its own chunk
    // rather than the watch route's. Start that download alongside the resolve
    // instead of after it, so splitting it out costs no playback latency. A
    // failed load degrades to the native `canPlayType` path below.
    const hlsModulePromise = nativeHlsSupported
      ? null
      : import("hls.js")
          .then((module) => module.default)
          .catch(() => null);

    (async () => {
      try {
        const data = await fetchResolve(sourceUrl);
        if (cancelled) return;

        const nextTracks = (data.tracks ?? []).filter((t) => t.file);
        const nextSources = data.sources ?? [];
        setTracks(nextTracks);
        setResolvedMedia({ url: data.url, tracks: nextTracks, sources: nextSources });
        const HlsModule = hlsModulePromise ? await hlsModulePromise : null;
        if (cancelled) return;
        const hlsSupported = Boolean(HlsModule?.isSupported());
        if (!nativeHlsSupported && hlsSupported && nextSources.length) {
          masterUrl = URL.createObjectURL(
            new Blob([createMasterPlaylist(nextSources)], {
              type: "application/vnd.apple.mpegurl",
            }),
          );
        }
        const src = masterUrl ?? proxied(data.url);

        if (nativeHlsSupported) {
          video.src = src;
        } else if (hlsSupported && HlsModule) {
          hls = new HlsModule({ enableWorker: true });
          hlsRef.current = hls;
          hls.on(HlsModule.Events.MANIFEST_PARSED, (_event, data) => {
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
          hls.on(HlsModule.Events.ERROR, (_e, payload) => {
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

  useEffect(() => {
    if (!error) return;
    toast.error(
      lang === "vf"
        ? t("No VF stream for this title.")
        : t("Stream unavailable. Try again later."),
    );
  }, [error, lang, t]);

  function changeQuality(index: number) {
    setQuality(index);
    if (hlsRef.current) hlsRef.current.nextLevel = index;
  }

  const saveProgress = useCallback((positionSeconds: number, durationSeconds: number) => {
    if (!durationSeconds) return;
    const now = Date.now();
    if (now - lastSavedAtRef.current < 5000) return;
    lastSavedAtRef.current = now;

    updatePlayHistoryProgress({
      type,
      id: tmdbId,
      season,
      episode,
      positionSeconds,
      durationSeconds,
    });
  }, [episode, season, tmdbId, type]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    saveProgress(video.currentTime, video.duration);
  }

  const selectedHeight = qualities.find((item) => item.index === quality)?.height;
  const castSource = selectedHeight
    ? resolvedMedia?.sources.find((source) => source.height === selectedHeight)?.file ??
      resolvedMedia?.url ??
      null
    : resolvedMedia?.url ?? null;
  const mediaKey = `${type}:${tmdbId}:${season ?? 1}:${episode ?? 1}`;

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
        <CastControls
          videoRef={videoRef}
          mediaKey={mediaKey}
          source={castSource}
          tracks={resolvedMedia?.tracks ?? []}
          title={title}
          onRemoteProgress={saveProgress}
          onGoogleCastingChange={setGoogleCasting}
        />
      </div>
      <video
        ref={videoRef}
        controls={!googleCasting}
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
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center text-sm text-white/70 pointer-events-none"
        >
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
