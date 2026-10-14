"use client";

import type Hls from "hls.js";
import { Crop, Maximize, Minimize, PictureInPicture2, RotateCcw } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import CastControls from "@/components/CastControls";
import {
  ControlButton,
  ControlGroup,
  PlayIcon,
  SEEK_STEP,
  SeekBar,
  SkipIcon,
  VolumeControl,
  seekBy,
  togglePlayback,
} from "@/components/PlayerControls";
import SubtitleMenu, { DELAY_STEP, formatDelay, type SyncStatus } from "@/components/SubtitleMenu";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { qualityClass } from "@/lib/quality-class";
import { fetchResolve } from "@/lib/resolve-client";
import {
  getPlayHistory,
  getResumePosition,
  updatePlayHistoryProgress,
} from "@/lib/play-history";
import type { PlaybackSource } from "@/lib/sources";
import { applySync, type SubtitleSync } from "@/lib/subtitle-timing";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

type PlayerMediaType = "movie" | "tv";
// `format: "srt"` asks /api/hls to convert the file to WebVTT.
type Track = { file: string; label?: string; lang?: string; format?: "srt" };
// height is the rendition's own; label is its 16:9 class (lib/quality-class).
type Quality = { index: number; height: number; label: number; bitrate: number };
type StreamSource = { file: string; height: number };
type ResolvedMedia = { url: string; sources: StreamSource[] };
type PresentationVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// /api/sources lists, in playback order, only the sources whose stream loads
// for the title; ids this build does not know are ignored. Viewers never pick:
// a failure moves on to the next listed source.
const KNOWN_SOURCES: Record<PlaybackSource, true> = {
  athena: true,
  helios: true,
  pandora: true,
  saturn: true,
  neptune: true,
  moscow: true,
  cine4k: true,
  moviesapi: true,
  videasyws: true,
  vidzee: true,
  moviebox: true,
  vidnest: true,
  vsrc: true,
  videm: true,
  "2embed": true,
  vidrock: true,
  videasy: true,
  vf: true,
};
// Tried before the availability list arrives, so playback does not wait on
// it. Athena serves both movies and episodes.
const DEFAULT_SOURCE: PlaybackSource = "athena";

function isKnownSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && Object.hasOwn(KNOWN_SOURCES, value);
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

// Providers label these languages in English.
const SITE_LANGUAGE_CODES: Record<string, string> = { english: "en", french: "fr" };

// Provider numbering ("English 2") is dropped; the player numbers its own list.
function baseLabel(label?: string) {
  return label?.trim().replace(/\s*\d+$/, "") ?? "";
}

function languageOf(label?: string): string | undefined {
  return SITE_LANGUAGE_CODES[baseLabel(label).toLowerCase()];
}

// Timing belongs to a release: providers can serve different cuts of a title.
const SYNC_KEY = "subtitle-sync-v2";
const MAX_SAVED_SYNCS = 300;
// A cue's own times, before any delay or scale was applied to it.
const originalCueTimes = new WeakMap<TextTrackCue, [number, number]>();

function isSync(value: unknown): value is SubtitleSync {
  if (typeof value !== "object" || value === null) return false;
  const { offset, scale } = value as Record<string, unknown>;
  return typeof offset === "number" && Number.isFinite(offset) && Math.abs(offset) <= 600 &&
    typeof scale === "number" && scale > 0.9 && scale < 1.1;
}

function isTrack(value: unknown): value is Track {
  if (typeof value !== "object" || value === null) return false;
  const { file, label, format } = value as Record<string, unknown>;
  return typeof file === "string" && /^https?:\/\//.test(file) && typeof label === "string" &&
    (format === undefined || format === "srt");
}

function trackSrc(track: Track) {
  return track.format === "srt" ? `${proxied(track.file)}&format=srt` : proxied(track.file);
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
  const { t, locale } = useTranslations();
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
  const [playing, setPlaying] = useState<Keyed<PlaybackSource> | null>(null);
  const [probeKey, setProbeKey] = useState(0);
  const availableList = forMedia(available, mediaKey);
  const failedList = forMedia(failed, mediaKey) ?? [];
  const usable = (id: PlaybackSource | undefined) => (id && !failedList.includes(id) ? id : undefined);
  const playingSource = usable(forMedia(playing, mediaKey));
  // Whatever already plays stays, else the first listed source that has not
  // failed here. A failure moves on to the next one.
  const source =
    playingSource ??
    (availableList ?? [DEFAULT_SOURCE]).find((id) => !failedList.includes(id)) ??
    null;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
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
  const [videoAspectRatio, setVideoAspectRatio] = useState<Keyed<number> | null>(null);
  const aspectRatioKey = `${sourceUrl}:${reloadKey}`;
  const [crop, setCrop] = useState<Keyed<boolean> | null>(null);
  const cropEnabled = forMedia(crop, aspectRatioKey) ?? false;
  const nativeAspectRatio = forMedia(videoAspectRatio, aspectRatioKey);
  const displayAspectRatio = cropEnabled
    ? Math.max(nativeAspectRatio ?? 16 / 9, 2.39)
    : nativeAspectRatio ?? 16 / 9;
  const [fullscreenMode, setFullscreenMode] = useState<"container" | "video" | null>(null);
  const [isFullscreen, setFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  // Subtitles other providers publish for the title (/api/subtitles), asked
  // for only once the playing source turns out to have none of its own. Most
  // sources at the top of the chain carry no subtitles.
  const [titleTracks, setTitleTracks] = useState<Keyed<Track[]> | null>(null);
  const titleList = forMedia(titleTracks, mediaKey);
  const needsTitleTracks = resolvedMedia !== null && tracks.length === 0;
  const shownTracks = useMemo(
    () => (tracks.length ? tracks : needsTitleTracks ? (titleList ?? []) : []),
    [needsTitleTracks, titleList, tracks],
  );
  // The source's files when it has any, else the title's; grouped by language
  // and localized.
  const allTracks = useMemo<Track[]>(() => {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    const rank = (lang?: string) => (lang === locale ? 0 : lang === "en" ? 1 : 2);
    const counts = new Map<string, number>();
    return shownTracks
      .map((track) => {
        // Number repeated language names consistently within this source.
        const base = baseLabel(track.label);
        const lang = languageOf(track.label);
        if (!lang) return { ...track, label: base };
        const name = names.of(lang);
        return name ? { ...track, lang, label: `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}` } : { ...track, lang };
      })
      .sort((a, b) => rank(a.lang) - rank(b.lang))
      .map((track, index) => {
        const label = track.label?.trim() || `Track ${index + 1}`;
        const count = (counts.get(label) ?? 0) + 1;
        counts.set(label, count);
        return { ...track, label: count > 1 ? `${label} ${count}` : label };
      });
  }, [locale, shownTracks]);
  // One request per title: the source can resolve more than once while the
  // availability list settles, and each answer is kept for the whole title.
  const titleRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (!needsTitleTracks || titleRequestRef.current === mediaKey) return;
    const key = mediaKey;
    titleRequestRef.current = key;
    fetch(`/api/subtitles?${mediaQuery}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("subtitles failed"))))
      .then((data: { tracks?: unknown }) => {
        const list = Array.isArray(data.tracks) ? data.tracks.filter(isTrack) : [];
        setTitleTracks({ key, value: list });
      })
      .catch(() => {
        // Optional: playback goes on without subtitles; a later resolve retries.
        if (titleRequestRef.current === key) titleRequestRef.current = null;
      });
  }, [mediaKey, mediaQuery, needsTitleTracks]);
  // The pick is kept by file, so tracks arriving or changing later do not move
  // it. Until the viewer picks, subtitles start on the source's first track.
  const [subtitle, setSubtitle] = useState<{ file: string | null; on: boolean } | null>(null);
  const subtitleOn = subtitle ? subtitle.on : tracks.length > 0;
  const pickedFile = subtitle ? subtitle.file : tracks[0]?.file;
  // A file missing from the list, such as the previous episode's on the TV
  // page, falls back to the first track.
  const activeSubtitle = !subtitleOn || !allTracks.length
    ? -1
    : Math.max(allTracks.findIndex((track) => track.file === pickedFile), 0);
  // Cast receives the same subtitle selected for local playback.
  const castTracks = useMemo(
    () => (activeSubtitle >= 0 ? [allTracks[activeSubtitle]] : []),
    [activeSubtitle, allTracks],
  );
  const activeFile = activeSubtitle >= 0 ? allTracks[activeSubtitle].file : null;
  const [syncs, setSyncs] = useState<Record<string, SubtitleSync> | null>(null);
  const activeSyncKey = activeFile ? JSON.stringify([mediaKey, source, activeFile]) : null;
  const activeSync: SubtitleSync = (activeSyncKey && syncs?.[activeSyncKey]) || { offset: 0, scale: 1 };
  const [syncStatus, setSyncStatus] = useState<{ key: string; status: SyncStatus } | null>(null);
  const [subtitleNotice, setSubtitleNotice] = useState<{ text: string; id: number } | null>(null);
  const [seekHint, setSeekHint] = useState<{ forward: boolean; id: number } | null>(null);
  const lastTapRef = useRef(0);
  const lastPointerTypeRef = useRef("");
  const idleTimerRef = useRef<number | undefined>(undefined);
  const [idle, setIdle] = useState(false);
  const controlsHidden = idle && !paused && !exhausted;
  const playbackControls = !googleCasting && !exhausted;

  // While playing, controls fade out after a short idle period. Hovering
  // them, keyboard focus, or an open menu inside them keeps them up.
  const revealControls = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (controlsRef.current?.querySelector(':hover, :focus-visible, [aria-expanded="true"]')) return;
      setIdle(true);
    }, 2500);
  }, []);

  useEffect(() => {
    const video = videoRef.current as PresentationVideo | null;
    if (document.fullscreenEnabled && containerRef.current?.requestFullscreen) {
      setFullscreenMode("container");
    } else if (video?.webkitEnterFullscreen) {
      // iOS Safari only fullscreens the video itself, with its own controls.
      setFullscreenMode("video");
    }
    setPipSupported(Boolean(document.pictureInPictureEnabled && video?.requestPictureInPicture));
    let wasFullscreen = false;
    function onFullscreenChange() {
      const active = document.fullscreenElement === containerRef.current;
      setFullscreen(active);
      if (wasFullscreen && !active) {
        // Hidden controls are inert and cannot take focus, so show them first.
        flushSync(revealControls);
        fullscreenButtonRef.current?.focus();
      }
      wasFullscreen = active;
    }
    const onEnterPip = () => setInPip(true);
    const onLeavePip = () => setInPip(false);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    video?.addEventListener("enterpictureinpicture", onEnterPip);
    video?.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      video?.removeEventListener("enterpictureinpicture", onEnterPip);
      video?.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [revealControls]);

  function hideControls() {
    window.clearTimeout(idleTimerRef.current);
    if (controlsRef.current?.querySelector(':focus-visible, [aria-expanded="true"]')) return;
    setIdle(true);
  }

  useEffect(() => {
    if (!paused) revealControls();
    return () => window.clearTimeout(idleTimerRef.current);
  }, [paused, revealControls]);

  // The browser draws cues at the video's bottom edge, under the control bar.
  // While the controls show, globals.css lifts them by the bar's overlap with
  // the video, kept current as the layout resizes. The lift moves every cue,
  // so files that place their own lines (a sign at the top) are left alone.
  useEffect(() => {
    const video = videoRef.current;
    const row = bottomRowRef.current;
    if (!video) return;
    const update = () => {
      const shown = Array.from(video.textTracks).find((track) => track.mode === "showing");
      const placed = Array.from(shown?.cues ?? []).some((cue) => cue instanceof VTTCue && cue.line !== "auto");
      const lift = !controlsHidden && row && !placed
        ? Math.max(0, video.getBoundingClientRect().bottom - row.getBoundingClientRect().top)
        : 0;
      video.style.setProperty("--subtitle-lift", `${Math.round(lift)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(video);
    if (row) observer.observe(row);
    // A picked file's cues arrive with its <track> load, which does not bubble.
    video.addEventListener("load", update, true);
    video.textTracks.addEventListener("change", update);
    return () => {
      observer.disconnect();
      video.removeEventListener("load", update, true);
      video.textTracks.removeEventListener("change", update);
    };
  }, [controlsHidden, playbackControls]);

  async function toggleFullscreen() {
    try {
      if (fullscreenMode === "video") {
        (videoRef.current as PresentationVideo | null)?.webkitEnterFullscreen?.();
      } else if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      toast.error(t("Fullscreen unavailable"));
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      toast.error(t("Picture-in-picture unavailable"));
    }
  }

  // Reapplied whenever the browser changes a mode or adds a track: Chrome's
  // automatic track selection can turn on a matching language by itself.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      video.querySelectorAll("track").forEach((element, index) => {
        const mode = index === activeSubtitle ? "showing" : "disabled";
        if (element.track.mode !== mode) element.track.mode = mode;
      });
    };
    apply();
    video.textTracks.addEventListener("change", apply);
    video.textTracks.addEventListener("addtrack", apply);
    return () => {
      video.textTracks.removeEventListener("change", apply);
      video.textTracks.removeEventListener("addtrack", apply);
    };
  }, [activeSubtitle, allTracks]);

  useEffect(() => {
    let saved: Record<string, SubtitleSync> = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "{}");
      if (parsed && typeof parsed === "object") {
        saved = Object.fromEntries(Object.entries(parsed).filter(([, value]) => isSync(value)));
      }
    } catch {
      // Unreadable storage starts empty.
    }
    setSyncs(saved);
  }, []);

  function saveSync(key: string, sync: SubtitleSync | null) {
    setSyncs((previous) => {
      const next = { ...previous };
      delete next[key];
      if (sync) next[key] = sync;
      const entries = Object.entries(next);
      const kept = Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_SAVED_SYNCS)));
      try {
        localStorage.setItem(SYNC_KEY, JSON.stringify(kept));
      } catch {
        // Storage may be full or blocked; the delay still applies now.
      }
      return kept;
    });
  }

  // A pending auto-sync is dropped when the viewer sets timing by hand, so its
  // answer cannot overwrite the newer choice.
  const autoSyncRef = useRef<AbortController | null>(null);

  useEffect(() => () => { autoSyncRef.current?.abort(); }, [activeSyncKey, sourceUrl]);

  function changeDelay(offset: number) {
    if (!activeSyncKey) return;
    autoSyncRef.current?.abort();
    saveSync(activeSyncKey, { offset: Math.round(offset * 100) / 100, scale: activeSync.scale });
    setSyncStatus(null);
  }

  async function autoSync() {
    const stream = resolvedMedia?.url;
    const track = activeSubtitle >= 0 ? allTracks[activeSubtitle] : null;
    if (!stream || !track || !activeSyncKey) return;
    const key = activeSyncKey;
    autoSyncRef.current?.abort();
    const controller = new AbortController();
    autoSyncRef.current = controller;
    setSyncStatus({ key, status: "syncing" });
    const query = new URLSearchParams({ stream, file: track.file });
    if (track.format) query.set("format", track.format);
    let status: SyncStatus = "failed";
    try {
      const response = await fetch(`/api/subtitles/sync?${query}`, { signal: controller.signal });
      const data: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (response.ok && isSync(data)) {
        saveSync(key, { offset: data.offset, scale: data.scale });
        status = "synced";
      } else if (response.status === 503 || response.status === 429) {
        status = "busy";
      } else if (data && typeof data === "object" && "code" in data) {
        const code = data.code;
        if (code === "unmatched" || code === "unsupported" || code === "unavailable" || code === "invalid-subtitles") status = code;
      }
    } catch {
      if (controller.signal.aborted) return;
    } finally {
      if (autoSyncRef.current === controller) {
        autoSyncRef.current = null;
        if (controller.signal.aborted) setSyncStatus((previous) => previous?.key === key ? null : previous);
      }
    }
    setSyncStatus((previous) => (previous?.key === key ? { key, status } : previous));
  }

  // Delay and scale are applied to the shown track's cues, from their own
  // times, whenever either changes or the file finishes loading.
  const { offset: syncOffset, scale: syncScale } = activeSync;
  useEffect(() => {
    const element = activeSubtitle >= 0 ? videoRef.current?.querySelectorAll("track")[activeSubtitle] : undefined;
    if (!element) return;
    const sync = { offset: syncOffset, scale: syncScale };
    const shift = () => {
      for (const cue of Array.from(element.track.cues ?? [])) {
        let original = originalCueTimes.get(cue);
        if (!original) {
          original = [cue.startTime, cue.endTime];
          originalCueTimes.set(cue, original);
        }
        cue.startTime = applySync(original[0], sync);
        cue.endTime = applySync(original[1], sync);
      }
    };
    shift();
    element.addEventListener("load", shift);
    return () => element.removeEventListener("load", shift);
  }, [activeSubtitle, allTracks, syncOffset, syncScale]);

  useEffect(() => {
    if (!subtitleNotice) return;
    const timer = window.setTimeout(() => setSubtitleNotice(null), 1200);
    return () => window.clearTimeout(timer);
  }, [subtitleNotice]);

  function toggleSubtitles() {
    if (allTracks.length) setSubtitle({ file: pickedFile ?? null, on: activeSubtitle < 0 });
  }

  function skip(forward: boolean) {
    const video = videoRef.current;
    if (!video) return;
    seekBy(video, forward ? SEEK_STEP : -SEEK_STEP);
    setSeekHint({ forward, id: Date.now() });
  }

  useEffect(() => {
    if (!seekHint) return;
    const timer = window.setTimeout(() => setSeekHint(null), 500);
    return () => window.clearTimeout(timer);
  }, [seekHint]);

  // Mouse: click plays or pauses, double-click toggles fullscreen.
  // Touch: tap shows or hides controls, double-tap on either side skips.
  function onSurfacePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const video = videoRef.current;
    lastPointerTypeRef.current = event.pointerType;
    if (!video || googleCasting) return;
    if (event.pointerType === "mouse") {
      if (event.button === 0) togglePlayback(video);
      revealControls();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const doubleTap = event.timeStamp - lastTapRef.current < 300;
    lastTapRef.current = doubleTap ? 0 : event.timeStamp;
    if (doubleTap && (x < 0.35 || x > 0.65)) {
      skip(x > 0.65);
      revealControls();
    } else if (controlsHidden || paused) {
      revealControls();
    } else {
      hideControls();
    }
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    const video = videoRef.current;
    const container = containerRef.current;
    const target = event.target;
    if (!video || !container || !(target instanceof HTMLElement)) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const inPlayer = container.contains(target);
    // Outside the player, only page-level focus counts, such as the body or
    // the main landmark; other controls keep their keys.
    if (!inPlayer && target.closest('a, button, input, textarea, select, [contenteditable], [role], [tabindex]:not([tabindex="-1"])')) return;
    revealControls();
    // Text fields, sliders, and menus keep their own keys.
    if (target.closest("input, textarea, select, [contenteditable], [aria-haspopup], [role=option]")) return;
    const onControl = Boolean(target.closest("button, a"));
    switch (event.key) {
      case " ":
        if (onControl) return;
        togglePlayback(video);
        break;
      case "k":
        togglePlayback(video);
        break;
      case "ArrowLeft":
        seekBy(video, -5);
        break;
      case "ArrowRight":
        seekBy(video, 5);
        break;
      case "j":
        skip(false);
        break;
      case "l":
        skip(true);
        break;
      case "ArrowUp":
      case "ArrowDown":
        // The page scrolls with these unless the player has focus.
        if (!inPlayer && !isFullscreen) return;
        video.muted = false;
        video.volume = Math.min(Math.max(video.volume + (event.key === "ArrowUp" ? 0.05 : -0.05), 0), 1);
        break;
      case "m":
        video.muted = !video.muted;
        break;
      case "f":
        if (!fullscreenMode) return;
        void toggleFullscreen();
        break;
      case "c":
        toggleSubtitles();
        break;
      // VLC's keys for subtitle delay, in finer steps than the menu's.
      case "g":
      case "h": {
        if (!activeFile) return;
        const offset = activeSync.offset + (event.key === "h" ? DELAY_STEP : -DELAY_STEP) / 5;
        changeDelay(offset);
        setSubtitleNotice({ text: `${t("Subtitle delay")}: ${formatDelay(offset)}`, id: Date.now() });
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => onShortcut(event);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lock screen, headset, and OS media keys.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({ title, artwork: poster ? [{ src: poster }] : [] });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void video.play().catch(() => undefined)],
      ["pause", () => video.pause()],
      ["seekbackward", (details) => seekBy(video, -(details.seekOffset ?? SEEK_STEP))],
      ["seekforward", (details) => seekBy(video, details.seekOffset ?? SEEK_STEP)],
      ["seekto", (details) => {
        if (details.seekTime !== undefined) video.currentTime = details.seekTime;
      }],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Unsupported actions are skipped.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Unsupported actions were never set.
        }
      }
      session.metadata = null;
    };
  }, [poster, title]);

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
        setResolvedMedia({ url: data.url, sources: nextSources });
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
          hls = new HlsModule({
            enableWorker: true,
            capLevelOnFPSDrop: true,
            capLevelToPlayerSize: true,
            // Subtitles come from <track> elements. hls.js's subtitle and
            // caption controllers clear the cues of every text track on the
            // video when a manifest loads or the player detaches, and a
            // loaded <track> is never fetched again, so they are left out.
            subtitleStreamController: undefined,
            subtitleTrackController: undefined,
            timelineController: undefined,
          });
          hlsRef.current = hls;
          hls.on(HlsModule.Events.MANIFEST_PARSED, (_event, data) => {
            const byLabel = new Map<number, Quality>();
            data.levels.forEach((level, index) => {
              if (!level.height) return;
              const label = qualityClass(level.width, level.height);
              const current = byLabel.get(label);
              if (!current || level.bitrate > current.bitrate) {
                byLabel.set(label, {
                  index,
                  height: level.height,
                  label,
                  bitrate: level.bitrate,
                });
              }
            });
            setQualities([...byLabel.values()].sort((a, b) => b.label - a.label));
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

  function updateAspectRatio() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const value = video.videoWidth / video.videoHeight;
    setVideoAspectRatio((previous) =>
      previous?.key === aspectRatioKey && previous.value === value
        ? previous
        : { key: aspectRatioKey, value },
    );
  }

  // Resumes on every source that loads, including failovers. A stream already
  // past its first second was positioned by the viewer and is left alone.
  function onLoadedMetadata() {
    updateAspectRatio();
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

  const interactive = controlsHidden ? "pointer-events-none" : "pointer-events-auto";

  return (
    <div
      ref={containerRef}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") revealControls();
      }}
      onPointerDown={revealControls}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !paused) hideControls();
      }}
      onFocus={revealControls}
      tabIndex={-1}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-black outline-none select-none",
        isFullscreen && "flex h-dvh items-center justify-center rounded-none",
        controlsHidden && "cursor-none",
      )}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: displayAspectRatio,
          width: isFullscreen ? `min(100%, calc(100dvh * ${displayAspectRatio}))` : undefined,
        }}
      >
        <video
          ref={videoRef}
          aria-label={`${t("Video player")}: ${title}`}
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          onResize={updateAspectRatio}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onEmptied={() => {
            setPaused(true);
            setBuffering(false);
            setVideoAspectRatio(null);
            setCrop(null);
          }}
          onTimeUpdate={onTimeUpdate}
          className={cn("absolute inset-0 h-full w-full bg-black", cropEnabled ? "object-cover" : "object-contain")}
          crossOrigin="anonymous"
          poster={poster ?? undefined}
        >
          {allTracks.map((track, i) => (
            <track
              key={track.file}
              kind="subtitles"
              label={track.label ?? `Track ${i + 1}`}
              srcLang={track.lang}
              src={trackSrc(track)}
            />
          ))}
        </video>
        {/* Pointer target for click and tap gestures; every action it offers
            also has a button or shortcut. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 touch-manipulation"
          onPointerDown={(event) => {
            event.stopPropagation();
            // Keeps shortcuts such as ↑/↓ volume working after a click on the
            // picture. Touch skips it: the focus event would reveal controls
            // the tap is about to toggle.
            if (event.pointerType === "mouse") containerRef.current?.focus({ preventScroll: true });
          }}
          onPointerUp={onSurfacePointerUp}
          onDoubleClick={() => {
            if (lastPointerTypeRef.current === "mouse" && fullscreenMode === "container") void toggleFullscreen();
          }}
        />
        {subtitleNotice && (
          <p
            key={subtitleNotice.id}
            role="status"
            className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-xs font-semibold text-white tabular-nums"
          >
            {subtitleNotice.text}
          </p>
        )}
        {seekHint && (
          <div
            key={seekHint.id}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 flex size-16 -translate-y-1/2 animate-in items-center justify-center rounded-full bg-black/60 text-white fade-in zoom-in-90 duration-150 motion-reduce:animate-none",
              seekHint.forward ? "right-[12%]" : "left-[12%]",
            )}
          >
            <SkipIcon forward={seekHint.forward} />
          </div>
        )}
        {(loading || awaitingSources || exhausted || buffering) && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80",
              // A stall mid-playback only needs the spinner, not the dimmed frame.
              (loading || awaitingSources || exhausted) && "bg-black/60",
              // The error state has a control of its own to click.
              !exhausted && "pointer-events-none",
            )}
          >
            {!exhausted && (
              <span
                aria-hidden="true"
                className="size-7 animate-spin rounded-full border-2 border-white/15 border-t-accent-red motion-reduce:animate-none"
              />
            )}
            <p role="status" aria-live="polite" className={cn("font-medium", buffering && !loading && !awaitingSources && !exhausted && "sr-only")}>
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
      {/* Mobile: toolbar on top, playback in the middle, seek bar at the
          bottom. From sm up everything sits in one bar at the bottom. */}
      <div
        ref={controlsRef}
        data-player-controls=""
        aria-hidden={controlsHidden}
        inert={controlsHidden}
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2 p-2 transition-opacity duration-200 motion-reduce:transition-none sm:justify-end sm:p-3",
          controlsHidden && "opacity-0",
        )}
        style={isFullscreen ? {
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        } : undefined}
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/60 to-transparent sm:hidden" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/80 to-transparent sm:h-36" />
        <div className="relative flex items-center justify-end gap-2 sm:order-last sm:justify-between">
          {playbackControls && (
            <ControlGroup className={cn("hidden sm:flex", interactive)}>
              <ControlButton
                aria-label={paused ? t("Play") : t("Pause")}
                title={paused ? t("Play") : t("Pause")}
                onClick={() => videoRef.current && togglePlayback(videoRef.current)}
              >
                <PlayIcon paused={paused} className="size-5!" />
              </ControlButton>
              <ControlButton aria-label={t("Back 10 seconds")} title={t("Back 10 seconds")} onClick={() => skip(false)} className="hidden md:inline-flex">
                <SkipIcon />
              </ControlButton>
              <ControlButton aria-label={t("Forward 10 seconds")} title={t("Forward 10 seconds")} onClick={() => skip(true)} className="hidden md:inline-flex">
                <SkipIcon forward />
              </ControlButton>
              <VolumeControl videoRef={videoRef} />
            </ControlGroup>
          )}
          <ControlGroup className={cn("relative", interactive)}>
            {allTracks.length > 0 && !googleCasting && (
              <SubtitleMenu
                container={containerRef}
                labels={allTracks.map((track, i) => track.label ?? `Track ${i + 1}`)}
                active={activeSubtitle}
                onSelect={(index) => setSubtitle(
                  index < 0 ? { file: pickedFile ?? null, on: false } : { file: allTracks[index].file, on: true },
                )}
                delay={activeSync.offset}
                onDelayChange={changeDelay}
                onReset={() => {
                  autoSyncRef.current?.abort();
                  if (activeSyncKey) saveSync(activeSyncKey, null);
                  setSyncStatus(null);
                }}
                syncStatus={syncStatus && syncStatus.key === activeSyncKey ? syncStatus.status : "idle"}
                onAutoSync={autoSync}
              />
            )}
            <ControlButton
              aria-label={t("Crop black bars")}
              aria-pressed={cropEnabled}
              title={cropEnabled ? t("Restore full frame") : t("Crop to widescreen (2.39:1)")}
              disabled={nativeAspectRatio === undefined || googleCasting}
              onClick={() => setCrop({ key: aspectRatioKey, value: !cropEnabled })}
            >
              <Crop aria-hidden="true" />
            </ControlButton>
            {pipSupported && (
              <ControlButton
                aria-label={inPip ? t("Exit picture-in-picture") : t("Picture-in-picture")}
                aria-pressed={inPip}
                title={inPip ? t("Exit picture-in-picture") : t("Picture-in-picture")}
                disabled={nativeAspectRatio === undefined || googleCasting}
                onClick={togglePictureInPicture}
                className="hidden sm:inline-flex"
              >
                <PictureInPicture2 aria-hidden="true" />
              </ControlButton>
            )}
            {fullscreenMode && (
              <ControlButton
                ref={fullscreenButtonRef}
                aria-label={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
                title={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
                disabled={googleCasting && !isFullscreen}
                onClick={toggleFullscreen}
              >
                {isFullscreen
                  ? <Minimize aria-hidden="true" />
                  : <Maximize aria-hidden="true" />}
              </ControlButton>
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
                    label: `${item.label}p`,
                  })),
                ]}
                className="h-11 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white tabular-nums hover:bg-white/15"
              />
            )}
            <CastControls
              videoRef={videoRef}
              mediaKey={mediaKey}
              source={castSource}
              tracks={castTracks}
              title={title}
              onRemoteProgress={saveProgress}
              onGoogleCastingChange={setGoogleCasting}
            />
          </ControlGroup>
        </div>
        {playbackControls && !loading && !awaitingSources && (
          // Centered on the whole player, outside the column flow: the toolbar
          // above is taller than the seek row below.
          <div className="absolute inset-0 flex items-center justify-center gap-8 sm:hidden">
            <ControlButton aria-label={t("Back 10 seconds")} onClick={() => skip(false)} className={cn("bg-black/40", interactive)}>
              <SkipIcon />
            </ControlButton>
            <ControlButton
              aria-label={paused ? t("Play") : t("Pause")}
              onClick={() => videoRef.current && togglePlayback(videoRef.current)}
              className={cn("size-14 border border-white/15 bg-black/60", interactive)}
            >
              <PlayIcon paused={paused} className="size-6!" />
            </ControlButton>
            <ControlButton aria-label={t("Forward 10 seconds")} onClick={() => skip(true)} className={cn("bg-black/40", interactive)}>
              <SkipIcon forward />
            </ControlButton>
          </div>
        )}
        {playbackControls && (
          // The top of the bottom controls on both layouts: the desktop
          // toolbar sits below it.
          <div ref={bottomRowRef} className={cn("relative px-1", interactive)}>
            <SeekBar videoRef={videoRef} visible={!controlsHidden} />
          </div>
        )}
      </div>
    </div>
  );
}
