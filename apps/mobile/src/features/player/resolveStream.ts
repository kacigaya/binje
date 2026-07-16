import { apiRequest } from "../../api/client";
import type { StreamResponse } from "../../types/api";

export type AudioVariant = "vo" | "vf";
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

export async function resolveStream(media: StreamMedia, variant: AudioVariant): Promise<StreamResponse> {
  const resolverBase = process.env.EXPO_PUBLIC_RESOLVE_BASE_URL?.trim().replace(/\/+$/, "");
  const endpoint = variant === "vf" ? "resolve-vf" : "resolve";
  const result = await apiRequest<StreamResponse>(resolverBase ? `/${endpoint}` : `/api/${endpoint}`, {
    query: buildResolveQuery(media),
    ...(resolverBase ? { baseUrl: resolverBase } : {}),
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
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://binje-stream.netlify.app").replace(/\/+$/, "");
  return `${base}/api/hls?url=${encodeURIComponent(url)}`;
}
