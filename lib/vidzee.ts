import { createTtlCache } from "@/lib/ttl-cache";
import type { ResolverResult } from "@/lib/videasy";

const API = "https://core.vidzee.wtf";
type Result = ResolverResult & { referer?: string };
const cache = createTtlCache<Result>(60_000);

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch { /* Invalid provider URLs are discarded. */ }
}

async function readJson(path: string): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("VidZee unavailable.");
  return response.json();
}

export function resolveVidzeeStream(params: {
  type: "movie" | "tv"; id: string; season: string; episode: string;
}): Promise<Result> {
  const { type, id, season, episode } = params;
  if (!/^\d+$/.test(id) || (type !== "movie" && type !== "tv") ||
      (type === "tv" && (!/^[1-9]\d*$/.test(season) || !/^[1-9]\d*$/.test(episode)))) {
    return Promise.reject(new Error("Invalid media."));
  }
  const path = `${type}/${id}${type === "tv" ? `/${season}/${episode}` : ""}`;
  return cache.get(path, async () => {
    // Only the English v4 server has been verified. Subtitles are optional.
    const [stream, subtitles] = await Promise.all([
      readJson(`/streams/${path}?s=v4%3AEnglish`),
      readJson(`/subs/${path}`).catch(() => []),
    ]);
    if (!stream || typeof stream !== "object" || !("url" in stream)) throw new Error("Missing stream.");
    const url = httpUrl(stream.url);
    if (!url) throw new Error("Invalid stream URL.");
    let referer: string | undefined;
    if ("headers" in stream && stream.headers && typeof stream.headers === "object" && "Referer" in stream.headers) {
      referer = httpUrl(stream.headers.Referer);
    }
    const tracks = Array.isArray(subtitles) ? subtitles.flatMap((track: unknown) => {
      if (!track || typeof track !== "object" || !("file" in track)) return [];
      const file = httpUrl(track.file);
      return file ? [{ file, label: "label" in track && typeof track.label === "string" ? track.label : undefined }] : [];
    }) : [];
    return { url, tracks, referer };
  });
}
