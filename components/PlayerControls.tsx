"use client";

import { Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

export const SEEK_STEP = 10;
const VOLUME_KEY = "player-volume";

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function seekBy(video: HTMLVideoElement, delta: number) {
  const end = Number.isFinite(video.duration) ? video.duration : Infinity;
  video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), end);
}

export function togglePlayback(video: HTMLVideoElement) {
  if (video.paused || video.ended) void video.play().catch(() => undefined);
  else video.pause();
}

export const controlButtonClass =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-red/60 active:bg-white/20 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-white/20 [&_svg]:pointer-events-none [&_svg]:size-4";

export function ControlButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn(controlButtonClass, className)} {...props} />;
}

export function ControlGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-1 rounded-full border border-white/15 bg-black/75 p-1", className)}>
      {children}
    </div>
  );
}

export function SkipIcon({ forward }: { forward?: boolean }) {
  const Icon = forward ? RotateCw : RotateCcw;
  return (
    <span aria-hidden="true" className="relative inline-flex">
      <Icon strokeWidth={1.75} className="size-6!" />
      <span className="absolute inset-0 flex items-center justify-center pt-px text-[0.5rem] font-bold tabular-nums">
        {SEEK_STEP}
      </span>
    </span>
  );
}

export function PlayIcon({ paused, className }: { paused: boolean; className?: string }) {
  const Icon = paused ? Play : Pause;
  return <Icon aria-hidden="true" fill="currentColor" strokeWidth={0} className={className} />;
}

/** Keep per-frame progress state here to avoid re-rendering the whole player. */
export function SeekBar({ videoRef, visible }: { videoRef: RefObject<HTMLVideoElement | null>; visible: boolean }) {
  const { t } = useTranslations();
  const fillRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  // Read by the frame loop, which must not re-subscribe on every drag step.
  const scrubRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible) return;
    let frame = 0;
    const paint = () => {
      const total = Number.isFinite(video.duration) ? video.duration : 0;
      const position = scrubRef.current ?? video.currentTime;
      fillRef.current?.style.setProperty("--progress", String(total ? position / total : 0));
    };
    // timeupdate fires ~4 times a second; a frame loop keeps the bar smooth.
    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };
    const sync = () => {
      setTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      const ranges = video.buffered;
      let end = 0;
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= video.currentTime + 0.5) end = Math.max(end, ranges.end(i));
      }
      setBuffered(end);
      paint();
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      sync();
    };
    const events = ["timeupdate", "durationchange", "progress", "seeking", "emptied", "loadedmetadata"];
    events.forEach((name) => video.addEventListener(name, sync));
    video.addEventListener("playing", start);
    video.addEventListener("pause", stop);
    video.addEventListener("waiting", stop);
    sync();
    if (!video.paused) start();
    return () => {
      cancelAnimationFrame(frame);
      events.forEach((name) => video.removeEventListener(name, sync));
      video.removeEventListener("playing", start);
      video.removeEventListener("pause", stop);
      video.removeEventListener("waiting", stop);
    };
  }, [videoRef, visible]);

  // Use native change to seek on release or a key step; React onChange fires throughout a drag.
  useEffect(() => {
    const input = inputRef.current;
    const video = videoRef.current;
    if (!input || !video) return;
    const commit = () => {
      video.currentTime = Number(input.value);
      scrubRef.current = null;
      setScrub(null);
    };
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [videoRef]);

  const shown = scrub ?? time;
  const seekable = duration > 0;

  return (
    <div className="flex items-center gap-3 text-xs font-medium text-white tabular-nums">
      <span className="min-w-10 text-right">{formatTime(shown)}</span>
      <div
        ref={fillRef}
        style={{ "--progress": 0 } as CSSProperties}
        className="group/seek relative flex h-6 flex-1 items-center rounded-full has-focus-visible:ring-2 has-focus-visible:ring-accent-red/60"
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-transform duration-150 group-hover/seek:scale-y-150 motion-reduce:transition-none">
          <div
            className="absolute inset-y-0 left-0 bg-white/30"
            style={{ width: seekable ? `${Math.min(buffered / duration, 1) * 100}%` : 0 }}
          />
          <div className="absolute inset-0 origin-left scale-x-(--progress) bg-accent-red" />
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 left-[calc(var(--progress)*100%)] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none",
            scrub === null && "scale-0 group-hover/seek:scale-100 group-has-focus-visible/seek:scale-100",
          )}
        />
        {scrub !== null && (
          <span className="pointer-events-none absolute bottom-full left-[calc(var(--progress)*100%)] mb-2 -translate-x-1/2 rounded-full border border-white/15 bg-black/75 px-2 py-1">
            {formatTime(scrub)}
          </span>
        )}
        <input
          ref={inputRef}
          type="range"
          aria-label={t("Seek")}
          aria-valuetext={`${formatTime(shown)} / ${formatTime(duration)}`}
          min={0}
          max={duration || 0}
          step="any"
          value={Math.min(shown, duration || 0)}
          disabled={!seekable}
          onChange={(event) => {
            scrubRef.current = Number(event.currentTarget.value);
            setScrub(scrubRef.current);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-default [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
        />
      </div>
      <span className="min-w-10">{formatTime(duration)}</span>
    </div>
  );
}

export function VolumeControl({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const { t } = useTranslations();
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "null") as unknown;
      if (saved && typeof saved === "object" && "volume" in saved && "muted" in saved) {
        const { volume: v, muted: m } = saved as { volume: unknown; muted: unknown };
        if (typeof v === "number" && v >= 0 && v <= 1) video.volume = v;
        if (typeof m === "boolean") video.muted = m;
      }
    } catch {
      // Unreadable storage keeps the defaults.
    }
    const sync = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      try {
        localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: video.volume, muted: video.muted }));
      } catch {
        // Storage may be full or blocked; volume still applies to this page.
      }
    };
    // Re-read volume on load because source changes can drop queued volumechange events.
    const events = ["volumechange", "loadstart", "play"];
    sync();
    events.forEach((name) => video.addEventListener(name, sync));
    return () => events.forEach((name) => video.removeEventListener(name, sync));
  }, [videoRef]);

  const silent = muted || volume === 0;
  const Icon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    if (silent && video.volume === 0) video.volume = 1;
    video.muted = !silent;
  }

  return (
    <div className="flex items-center">
      <ControlButton aria-label={silent ? t("Unmute") : t("Mute")} title={silent ? t("Unmute") : t("Mute")} onClick={toggleMute}>
        <Icon aria-hidden="true" />
      </ControlButton>
      <div className="relative hidden h-11 w-20 items-center pr-3 pl-1 lg:flex">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-white" style={{ width: `${silent ? 0 : volume * 100}%` }} />
        </div>
        <input
          type="range"
          aria-label={t("Volume")}
          aria-valuetext={`${Math.round((silent ? 0 : volume) * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={silent ? 0 : volume}
          onChange={(event) => {
            const video = videoRef.current;
            if (!video) return;
            video.volume = Number(event.currentTarget.value);
            video.muted = video.volume === 0;
          }}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 right-1 left-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-accent-red/60" />
      </div>
    </div>
  );
}
