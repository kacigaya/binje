"use client";

import { useEffect, useState } from "react";
import { RESOLVE_BASE, proxied } from "@/components/Player";
import { parseTsCodecs, type StreamTech } from "@/lib/stream-probe";

type Info = StreamTech & { height: number | null };

function firstNonComment(playlist: string) {
  return playlist
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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
        const res = await fetch(`${RESOLVE_BASE}/resolve?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          url: string;
          sources?: { file: string; height: number }[];
        };

        let height = data.sources?.length
          ? Math.max(...data.sources.map((s) => s.height))
          : null;
        const topFile = data.sources?.length
          ? data.sources.reduce((a, b) => (b.height > a.height ? b : a)).file
          : data.url;

        // Playlist lines come back rewritten to /api/hls by the proxy, so
        // follow-up fetches use them as-is.
        let playlist = await fetch(proxied(topFile)).then((r) => r.text());
        if (playlist.includes("#EXT-X-STREAM-INF")) {
          const heights = [...playlist.matchAll(/RESOLUTION=\d+x(\d+)/g)].map(
            (m) => Number(m[1]),
          );
          if (height === null && heights.length) height = Math.max(...heights);
          const variant = firstNonComment(playlist);
          if (!variant) return;
          playlist = await fetch(variant).then((r) => r.text());
        }

        const segment = firstNonComment(playlist);
        if (!segment) return;
        const buffer = await fetch(segment, {
          headers: { range: "bytes=0-131071" },
        }).then((r) => r.arrayBuffer());

        const tech = parseTsCodecs(new Uint8Array(buffer));
        if (!cancelled) setInfo({ height, ...tech });
      } catch {
        // Silent: badges simply don't render when the stream can't be probed.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imdbId, title, tmdbId, type, year]);

  if (!info) return null;

  const badges: string[] = [];
  if (info.height) badges.push(info.height >= 2160 ? "4K" : `${info.height}p`);
  // ponytail: playlists carry no VIDEO-RANGE; HEVC→HDR is a heuristic, H264→SDR is fact.
  if (info.video) badges.push(info.video === "HEVC" ? "HDR" : "SDR");
  if (info.audio) badges.push(info.audio);
  if (badges.length === 0) return null;

  return (
    <>
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/70"
        >
          {badge}
        </span>
      ))}
    </>
  );
}
