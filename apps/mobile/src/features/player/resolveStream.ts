import { apiRequest } from "../../api/client";
import type { PlaybackSource, SourcesResponse, StreamResponse } from "../../types/api";

export type { PlaybackSource };

// The server lists sources in playback order; ids this build does not know
// are ignored so a newer server cannot break an older app. Viewers never
// pick: a failure moves on to the next listed source.
const KNOWN_SOURCES: Record<PlaybackSource, true> = {
  cine4k: true,
  athena: true,
  helios: true,
  planets: true,
  moviesapi: true,
  videasyws: true,
  moscow: true,
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
// it. Cine4K has no episodes, so TV starts on Athena.
export const DEFAULT_SOURCE: Record<"movie" | "tv", PlaybackSource> = { movie: "cine4k", tv: "athena" };
// The server resolves every provider before answering.
const SOURCES_TIMEOUT_MS = 25_000;

export function isKnownSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && Object.hasOwn(KNOWN_SOURCES, value);
}
export type StreamMedia = {
  type: "movie" | "tv";
  id: number;
  title: string;
  year: string;
  imdbId?: string | null;
  season?: number;
  episode?: number;
};

export function buildResolveQuery(media: StreamMedia) {
  if (!Number.isInteger(media.id) || media.id <= 0) throw new Error("A valid media ID is required.");
  if (!media.title.trim() || !/^\d{4}$/.test(media.year)) throw new Error("A title and four-digit year are required.");
  if (media.type === "tv" && (!media.season || !media.episode)) {
    throw new Error("TV playback requires season and episode numbers.");
  }
  return {
    type: media.type,
    id: media.id,
    title: media.title.trim(),
    year: media.year,
    imdbId: media.imdbId ?? "",
    ...(media.type === "tv" ? { season: media.season!, episode: media.episode! } : {}),
  };
}

function isPlayableUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function fetchAvailableSources(media: StreamMedia): Promise<PlaybackSource[]> {
  const result = await apiRequest<SourcesResponse>("/api/sources", {
    query: buildResolveQuery(media),
    timeoutMs: SOURCES_TIMEOUT_MS,
  });
  return Array.isArray(result.sources) ? result.sources.filter(isKnownSource) : [];
}

export async function resolveStream(media: StreamMedia, source: PlaybackSource): Promise<StreamResponse> {
  const result = await apiRequest<StreamResponse>("/api/resolve", {
    query: { ...buildResolveQuery(media), source },
  });
  if (!isPlayableUrl(result.url)) throw new Error("The server did not return a playable stream.");
  return {
    url: result.url,
    tracks: Array.isArray(result.tracks) ? result.tracks.filter((track) => isPlayableUrl(track.file)) : [],
    sources: Array.isArray(result.sources)
      ? result.sources.filter((source) => isPlayableUrl(source.file) && Number.isFinite(source.height))
      : undefined,
  };
}

export function proxiedHlsUrl(url: string): string {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://binje.duckdns.org").replace(/\/+$/, "");
  return `${base}/api/hls?url=${encodeURIComponent(url)}`;
}
