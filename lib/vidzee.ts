import { createTtlCache } from "@/lib/ttl-cache";
import type { ResolverResult } from "@/lib/videasy";

type Track = ResolverResult["tracks"][number];

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

type Media = { type: "movie" | "tv"; id: string; season: string; episode: string };
const subtitleCache = createTtlCache<Track[]>(10 * 60 * 1000);

function vidzeePath({ type, id, season, episode }: Media): string | null {
  if (!/^\d+$/.test(id) || (type !== "movie" && type !== "tv") ||
      (type === "tv" && (!/^[1-9]\d*$/.test(season) || !/^[1-9]\d*$/.test(episode)))) {
    return null;
  }
  return `${type}/${id}${type === "tv" ? `/${season}/${episode}` : ""}`;
}

// The subtitle list has its own endpoint, so it is offered even when VidZee's
// stream is down; the title's other sources can play with it.
export function vidzeeSubtitles(params: Media): Promise<Track[]> {
  const path = vidzeePath(params);
  if (!path) return Promise.reject(new Error("Invalid media."));
  return subtitleCache.get(path, async () => {
    const subtitles = await readJson(`/subs/${path}`);
    return Array.isArray(subtitles) ? subtitles.flatMap((track: unknown) => {
      if (!track || typeof track !== "object" || !("file" in track)) return [];
      const file = httpUrl(track.file);
      return file ? [{ file, label: "label" in track && typeof track.label === "string" ? track.label : undefined }] : [];
    }) : [];
  });
}

export function resolveVidzeeStream(params: Media): Promise<Result> {
  const path = vidzeePath(params);
  if (!path) return Promise.reject(new Error("Invalid media."));
  return cache.get(path, async () => {
    // Only the English v4 server has been verified. Subtitles are optional.
    const [stream, tracks] = await Promise.all([
      readJson(`/streams/${path}?s=v4%3AEnglish`),
      vidzeeSubtitles(params).catch(() => []),
    ]);
    if (!stream || typeof stream !== "object" || !("url" in stream)) throw new Error("Missing stream.");
    const url = httpUrl(stream.url);
    if (!url) throw new Error("Invalid stream URL.");
    let referer: string | undefined;
    if ("headers" in stream && stream.headers && typeof stream.headers === "object" && "Referer" in stream.headers) {
      referer = httpUrl(stream.headers.Referer);
    }
    return { url, tracks, referer };
  });
}
