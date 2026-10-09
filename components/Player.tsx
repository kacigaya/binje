"use client";

import type Hls from "hls.js";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import CastControls from "@/components/CastControls";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { fetchResolve } from "@/lib/resolve-client";
import {
  getPlayHistory,
  getResumePosition,
  updatePlayHistoryProgress,
} from "@/lib/play-history";
import type { PlaybackSource } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

type PlayerMediaType = "movie" | "tv";
type Track = { file: string; label?: string };
type Quality = { index: number; height: number; bitrate: number };
type StreamSource = { file: string; height: number };
type ResolvedMedia = { url: string; tracks: Track[]; sources: StreamSource[] };

// /api/sources lists, in preference order, only the sources whose stream
// loads for the title; ids this build does not know are ignored.
const SOURCE_LABELS: Record<PlaybackSource, string> = {
  vidzee: "VidZee · EN",
  moviebox: "MovieBox · EN",
  vidnest: "Vidnest · VO",
  vsrc: "Vsrc · VO",
  videm: "Videm · VO",
  "2embed": "2Embed · VO",
  moviesapi: "MoviesAPI · VO",
  vidrock: "Vidrock · VO",
  videasy: "Videasy · VO",
  vf: "French · VF",
};
// Tried before the availability list arrives, so playback does not wait on it.
const DEFAULT_SOURCE: PlaybackSource = "vidzee";

function isKnownSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && Object.hasOwn(SOURCE_LABELS, value);
}

// The TV page keeps this component mounted across episodes, so per-title
// state carries the media key it belongs to and is ignored once that changes.
type Keyed<T> = { key: string; value: T };
function forMedia<T>(state: Keyed<T> | null, key: string): T | undefined {
  return state?.key === key ? state.value : undefined;
}

const RESOLVE_BASE = "/api";

function proxied(url: string) {
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

// Upstream reports height only, so bitrates come from a conservative H.264
// ladder; unknown heights use the nearest lower rung.
const BITRATE_LADDER: [height: number, bandwidth: number][] = [
  [2160, 16_000_000],
  [1440, 10_000_000],
  [1080, 6_000_000],
  [720, 3_000_000],
  [480, 1_400_000],
  [360, 800_000],
  [240, 400_000],
];

function ladderBandwidth(height: number): number {
  for (const [rung, bandwidth] of BITRATE_LADDER) {
    if (height >= rung) return bandwidth;
  }
  return BITRATE_LADDER[BITRATE_LADDER.length - 1][1];
}

function createMasterPlaylist(sources: StreamSource[]) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  const seen = new Set<number>();
  const renditions = [...sources]
    .filter((source) => {
      if (!Number.isFinite(source.height) || source.height <= 0) return false;
      if (seen.has(source.height)) return false;
      seen.add(source.height);
      return true;
    })
    .sort((a, b) => b.height - a.height);
  for (const source of renditions) {
    const width = Math.round((source.height * 16) / 9 / 2) * 2;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${ladderBandwidth(source.height)},RESOLUTION=${width}x${source.height}`,
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
  poster,
}: {
  tmdbId: number;
  title: string;
  year: string;
  imdbId?: string | null;
  type?: PlayerMediaType;
  season?: number;
  episode?: number;
  /** Backdrop shown behind the loading state until playback starts. */
  poster?: string | null;
}) {
  const { t } = useTranslations();
  const mediaKey = `${type}:${tmdbId}:${season ?? 1}:${episode ?? 1}`;
  const mediaQuery = useMemo(() => {
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
    return params.toString();
  }, [episode, imdbId, season, title, tmdbId, type, year]);

  // undefined while probing, null when the probe itself failed.
  const [available, setAvailable] = useState<Keyed<PlaybackSource[] | null> | null>(null);
  const [failed, setFailed] = useState<Keyed<PlaybackSource[]> | null>(null);
  const [picked, setPicked] = useState<Keyed<PlaybackSource> | null>(null);
  const [playing, setPlaying] = useState<Keyed<PlaybackSource> | null>(null);
  const [probeKey, setProbeKey] = useState(0);
  const availableList = forMedia(available, mediaKey);
  const failedList = forMedia(failed, mediaKey) ?? [];
  const usable = (id: PlaybackSource | undefined) => (id && !failedList.includes(id) ? id : undefined);
  const playingSource = usable(forMedia(playing, mediaKey));
  // A manual pick wins, then whatever already plays, then the first listed
  // source that has not failed here. A failure moves on to the next one.
  const source =
    usable(forMedia(picked, mediaKey)) ??
    playingSource ??
    (availableList ?? [DEFAULT_SOURCE]).find((id) => !failedList.includes(id)) ??
    null;
  const options = [...(availableList ?? [])];
  if (playingSource && !options.includes(playingSource)) options.push(playingSource);
  const sourceOptions = options.filter((id) => !failedList.includes(id));
  const exhausted = source === null && availableList !== undefined;
  // Waiting for the availability list after the default source failed.
  const awaitingSources = source === null && !exhausted;

  useEffect(() => {
    let cancelled = false;
    fetch(`${RESOLVE_BASE}/sources?${mediaQuery}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("probe failed"))))
      .then((data: { sources?: unknown }) => {
        const list = Array.isArray(data.sources) ? data.sources.filter(isKnownSource) : [];
        if (!cancelled) setAvailable({ key: mediaKey, value: list });
      })
      .catch(() => {
        if (!cancelled) setAvailable({ key: mediaKey, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mediaKey, mediaQuery, probeKey]);

  const sourceUrl = source ? `${RESOLVE_BASE}/resolve?${mediaQuery}&source=${source}` : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAtRef = useRef(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [googleCasting, setGoogleCasting] = useState(false);
  // Bumped by the retry control so the resolve below runs again without a
  // full page reload.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video || !source || !sourceUrl) return;

    const fail = () => {
      setFailed((previous) => {
        const list = forMedia(previous, mediaKey) ?? [];
        return { key: mediaKey, value: list.includes(source) ? list : [...list, source] };
      });
    };
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
    // hls.js (~600 KB) is its own chunk, loaded alongside the resolve.
    // A failed load degrades to the native `canPlayType` path below.
    const hlsModulePromise = nativeHlsSupported
      ? null
      : import("hls.js")
          .then((module) => module.default)
          .catch(() => null);

    (async () => {
      try {
        const data = await fetchResolve(sourceUrl, reloadKey > 0);
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
            if (payload.fatal && !cancelled) fail();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else {
          throw new Error("HLS unsupported");
        }
        setLoading(false);
        setPlaying({ key: mediaKey, value: source });
      } catch {
        if (!cancelled) {
          setLoading(false);
          fail();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current === hls) hlsRef.current = null;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (masterUrl) URL.revokeObjectURL(masterUrl);
    };
  }, [mediaKey, reloadKey, source, sourceUrl]);

  useEffect(() => {
    if (exhausted) toast.error(t("Stream unavailable. Try again later."));
  }, [exhausted, t]);

  function retry() {
    setFailed(null);
    setPicked(null);
    setPlaying(null);
    setAvailable(null);
    setProbeKey((previous) => previous + 1);
    setReloadKey((previous) => previous + 1);
  }

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

  // Resumes on every source that loads, including failovers. A stream already
  // past its first second was positioned by the viewer and is left alone.
  function onLoadedMetadata() {
    const video = videoRef.current;
    if (!video || video.currentTime > 1) return;
    const position = getResumePosition(getPlayHistory(), {
      type,
      id: tmdbId,
      season,
      episode,
    });
    if (position !== null && position < video.duration - 10) {
      video.currentTime = position;
    }
  }

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
  let statusText = t("Loading…");
  if (exhausted) statusText = t("Stream unavailable. Try again later.");
  else if (awaitingSources) statusText = t("Checking sources…");
  else if (source) statusText = `${t("Connecting to")} ${SOURCE_LABELS[source]}`;

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-full border border-white/15 bg-black/75 p-1">
        {source && sourceOptions.includes(source) && (
          <Select
            ariaLabel={t("Source")}
            value={source}
            onValueChange={(value) => setPicked({ key: mediaKey, value })}
            items={sourceOptions.map((id) => ({ value: id, label: SOURCE_LABELS[id] }))}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
          />
        )}
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
        aria-label={`${t("Video player")}: ${title}`}
        controls={!googleCasting}
        playsInline
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        className="absolute inset-0 h-full w-full rounded-xl bg-black"
        crossOrigin="anonymous"
        poster={poster ?? undefined}
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
      {(loading || awaitingSources || exhausted) && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center text-sm text-white/80",
            // While loading the overlay must not swallow the native controls;
            // the error state has a control of its own to click.
            !exhausted && "pointer-events-none",
          )}
        >
          {!exhausted && (
            <span
              aria-hidden="true"
              className="size-7 animate-spin rounded-full border-2 border-white/15 border-t-accent-red motion-reduce:animate-none"
            />
          )}
          <p role="status" aria-live="polite" className="font-medium">
            {statusText}
          </p>
          {exhausted && (
            <Button
              type="button"
              variant="outline"
              onClick={retry}
              className="h-9 cursor-pointer gap-2 rounded-full px-4"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              {t("Try Again")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
