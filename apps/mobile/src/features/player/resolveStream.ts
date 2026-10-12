import { apiRequest } from "../../api/client";
import type { PlaybackSource, SourcesResponse, StreamResponse } from "../../types/api";

export type { PlaybackSource };

// The server lists sources in preference order; ids this build does not know
// are ignored so a newer server cannot break an older app.
export const SOURCE_LABELS: Record<PlaybackSource, { label: string; pill: string }> = {
  videasyws: { label: "Videasy.ws · VO", pill: "Videasy.ws" },
  cine4k: { label: "Cine4K · 4K VO", pill: "Cine4K" },
  vidzee: { label: "VidZee · EN", pill: "VidZee" },
  moviebox: { label: "MovieBox · EN", pill: "MovieBox" },
  vidnest: { label: "Vidnest · VO", pill: "Vidnest" },
  vsrc: { label: "Vsrc · VO", pill: "Vsrc" },
  videm: { label: "Videm · VO", pill: "Videm" },
  "2embed": { label: "2Embed · VO", pill: "2Embed" },
  moviesapi: { label: "MoviesAPI · VO", pill: "MoviesAPI" },
  vidrock: { label: "Vidrock · VO", pill: "Vidrock" },
  videasy: { label: "Videasy · VO", pill: "VO" },
  vf: { label: "French · VF", pill: "VF" },
};
// Tried before the availability list arrives, so playback does not wait on it.
export const DEFAULT_SOURCE: PlaybackSource = "videasyws";
// The server resolves every provider before answering.
const SOURCES_TIMEOUT_MS = 25_000;

export function isKnownSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && Object.hasOwn(SOURCE_LABELS, value);
}
export const ALL_SOURCES = Object.keys(SOURCE_LABELS).filter(isKnownSource);
// Never listed for episodes: these providers have no TV streams at all.
const MOVIE_ONLY_SOURCES: readonly PlaybackSource[] = ["cine4k"];

// Every known source, the ones the probe listed first. Sources that failed
// here or that the probe left out are flagged and sorted last, not hidden:
// probes can be wrong, and a manual pick tries them anyway. Nothing is
// flagged while the probe runs or when it failed outright.
export function sourceMenu(
  available: readonly PlaybackSource[] | null | undefined,
  failed: readonly PlaybackSource[],
  current: PlaybackSource | null,
  type: "movie" | "tv" = "movie",
): { id: PlaybackSource; unavailable: boolean }[] {
  const all = type === "tv" ? ALL_SOURCES.filter((id) => !MOVIE_ONLY_SOURCES.includes(id)) : ALL_SOURCES;
  const listed = (available ?? []).filter((id) => all.includes(id));
  const ordered = [...listed, ...all.filter((id) => !listed.includes(id))];
  const unavailable = (id: PlaybackSource) =>
    id !== current && (failed.includes(id) || (Array.isArray(available) && !available.includes(id)));
  return [...ordered.filter((id) => !unavailable(id)), ...ordered.filter(unavailable)].map((id) => ({
    id,
    unavailable: unavailable(id),
  }));
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
