"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StreamTech } from "@/lib/stream-probe";

type Info = StreamTech & { height: number | null };

// Nothing from @/components/Player is imported here on purpose: that module
// pulls hls.js in, and it would land in the detail page bundle for three
// decorative badges.

export default function StreamTechBadges({
  type,
  tmdbId,
  title,
  year,
  imdbId,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: string;
  imdbId?: string | null;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [shouldProbe, setShouldProbe] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const cacheKey = useMemo(
    () => `binje:stream-tech:${type}:${tmdbId}`,
    [tmdbId, type],
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    // Safari has no requestIdleCallback, so fall back to a plain timer. Both
    // handles are plain numbers; the flag records which one to cancel.
    const idle = typeof window.requestIdleCallback === "function";
    let idleId: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        idleId = idle
          ? window.requestIdleCallback(() => setShouldProbe(true), { timeout: 5000 })
          : window.setTimeout(() => setShouldProbe(true), 2500);
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (idleId === undefined) return;
      if (idle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, []);

  useEffect(() => {
    if (!shouldProbe) return;
    let cancelled = false;

    (async () => {
      try {
        const cached = window.sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Info;
          if (!cancelled) setInfo(parsed);
          return;
        }

        const params = new URLSearchParams({
          type,
          id: String(tmdbId),
          title,
          year,
          imdbId: imdbId ?? "",
        });
        if (type === "tv") {
          params.set("season", "1");
          params.set("episode", "1");
        }
        // The resolve chain, both playlists and the 128 KB transport-stream
        // read all happen server-side now, behind a shared six-hour cache.
        const response = await fetch(`/api/stream-tech?${params.toString()}`);
        if (!response.ok) return;
        const nextInfo = (await response.json()) as Info;

        window.sessionStorage.setItem(cacheKey, JSON.stringify(nextInfo));
        if (!cancelled) setInfo(nextInfo);
      } catch {
        // Silent: badges simply don't render when the stream can't be probed.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, imdbId, shouldProbe, title, tmdbId, type, year]);

  if (!info) return <span ref={sentinelRef} aria-hidden="true" />;

  const badges: string[] = [];
  if (info.height) badges.push(info.height >= 2160 ? "4K" : `${info.height}p`);
  if (info.video) badges.push(info.video === "HEVC" ? "HDR" : "SDR");
  if (info.audio) badges.push(info.audio);
  if (badges.length === 0) return <span ref={sentinelRef} aria-hidden="true" />;

  return (
    <span ref={sentinelRef} className="contents">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/70"
        >
          {badge}
        </span>
      ))}
    </span>
  );
}
