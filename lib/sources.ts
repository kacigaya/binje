import { resolveFrembedStream } from "@/lib/frembed";
import { allowStreamCookie, allowStreamHost, allowStreamHosts } from "@/lib/hls-hosts";
import { resolveMovieboxStream } from "@/lib/moviebox";
import { resolveMoviesapiStream } from "@/lib/moviesapi";
import { cachedResolveVideasyStream, type ResolveParams } from "@/lib/resolve-cache";
import { isPlayableManifest, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import type { PlaybackSource } from "@/types/mobile-api";
import { resolveTwoEmbedStream } from "@/lib/twoembed";
import { resolveVidnestStream } from "@/lib/vidnest";
import { resolveVidrockStream } from "@/lib/vidrock";
import { resolveVidzeeStream } from "@/lib/vidzee";
import { resolveVidemStream, resolveVsrcStream } from "@/lib/vsrc";

export type { PlaybackSource };

// Preference order: players start with the first available source. French
// stays last because every other source plays the original audio.
export const PLAYBACK_SOURCES = [
  "vidzee",
  "moviebox",
  "vidnest",
  "vsrc",
  "videm",
  "2embed",
  "moviesapi",
  "vidrock",
  "videasy",
  "vf",
] as const satisfies readonly PlaybackSource[];

const RESOLVERS: Record<PlaybackSource, (params: ResolveParams) => Promise<ResolvedStream>> = {
  vidzee: resolveVidzeeStream,
  moviebox: resolveMovieboxStream,
  vidnest: resolveVidnestStream,
  vsrc: resolveVsrcStream,
  videm: resolveVidemStream,
  "2embed": resolveTwoEmbedStream,
  moviesapi: resolveMoviesapiStream,
  vidrock: resolveVidrockStream,
  videasy: cachedResolveVideasyStream,
  vf: resolveFrembedStream,
};

// A source counts as unavailable when it has not answered by then; the
// availability route must finish inside its own maxDuration.
const PROBE_DEADLINE_MS = 15_000;
const AVAILABILITY_TTL_MS = 2 * 60 * 1000;
const availabilityCache = createTtlCache<PlaybackSource[]>(AVAILABILITY_TTL_MS);

export function isPlaybackSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && (PLAYBACK_SOURCES as readonly string[]).includes(value);
}

// Registers everything the proxy will be asked for: the stream, its tracks
// and fixed-quality renditions, with the headers the provider requires.
export async function resolvePlaybackSource(source: PlaybackSource, params: ResolveParams): Promise<ResolvedStream> {
  const result = await RESOLVERS[source](params);
  allowStreamHost(result.url, result.referer, result.userAgent);
  if (result.cookie && result.cookieScope) allowStreamCookie(result.cookieScope, result.cookie);
  allowStreamHosts([...result.tracks.map((track) => track.file), ...(result.sources ?? []).map((item) => item.file)]);
  return result;
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out.")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function isAvailable(source: PlaybackSource, params: ResolveParams) {
  const result = await resolvePlaybackSource(source, params);
  const cookie = result.cookieScope && result.url.startsWith(result.cookieScope) ? result.cookie : undefined;
  return isPlayableManifest(result.url, { referer: result.referer, userAgent: result.userAgent, cookie });
}

// Every source is resolved for the title, in parallel, and only those whose
// manifest loads are listed. The resolved streams stay in each resolver's
// cache, so the playback request that follows does not resolve again.
export function availablePlaybackSources(params: ResolveParams): Promise<PlaybackSource[]> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return availabilityCache.get(key, async () => {
    const checks = await Promise.allSettled(
      PLAYBACK_SOURCES.map((source) => withDeadline(isAvailable(source, params), PROBE_DEADLINE_MS)),
    );
    return PLAYBACK_SOURCES.filter((_, index) => {
      const check = checks[index];
      return check.status === "fulfilled" && check.value;
    });
  });
}

// The title query shared by /api/resolve and /api/sources; null when invalid.
export function parseResolveParams(query: URLSearchParams): ResolveParams | null {
  const type = query.get("type");
  const id = query.get("id") ?? "";
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  if (
    (type !== "movie" && type !== "tv") ||
    !/^\d+$/.test(id) ||
    !title ||
    title.length > 200 ||
    !/^\d{4}$/.test(year) ||
    (imdbId !== "" && !/^tt\d+$/.test(imdbId)) ||
    (type === "tv" && !(/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode)))
  ) {
    return null;
  }
  return { type, id, title, year, imdbId, season, episode };
}
