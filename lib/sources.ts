import { resolveAtlanticStream } from "@/lib/atlantic";
import { resolveCine4kStream } from "@/lib/cine4k";
import { resolveFrembedStream } from "@/lib/frembed";
import { allowStreamCookie, allowStreamHost, allowStreamHosts } from "@/lib/hls-hosts";
import { resolveMovieboxStream } from "@/lib/moviebox";
import { resolveMoviesapiStream } from "@/lib/moviesapi";
import { cachedResolveVideasyStream, type ResolveParams } from "@/lib/resolve-cache";
import { probeManifest, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import type { PlaybackSource } from "@/types/mobile-api";
import { resolveTwoEmbedStream } from "@/lib/twoembed";
import { resolveVidnestStream } from "@/lib/vidnest";
import { resolveVidrockStream } from "@/lib/vidrock";
import { resolveVidzeeStream } from "@/lib/vidzee";
import { resolveVidemStream, resolveVsrcStream } from "@/lib/vsrc";
import { resolveVideasyWsStream } from "@/lib/videasyws";

export type { PlaybackSource };

// Automatic failover tries the tallest advertised rendition first. Equal heights follow
// Atlantic's server order, excluding Aphrodite, then other providers.
// VF stays outside the chain but remains available through RESOLVERS and /api/resolve-vf.
export const PLAYBACK_SOURCES = [
  "athena",
  "helios",
  "pandora",
  "moscow",
  "cine4k",
  "moviesapi",
  "videasyws",
  "vidzee",
  "moviebox",
  "vidnest",
  "vsrc",
  "videm",
  "2embed",
  "vidrock",
  "videasy",
] as const satisfies readonly PlaybackSource[];

const RESOLVERS: Record<PlaybackSource, (params: ResolveParams) => Promise<ResolvedStream>> = {
  videasyws: resolveVideasyWsStream,
  cine4k: resolveCine4kStream,
  athena: resolveAtlanticStream("athena"),
  helios: resolveAtlanticStream("helios"),
  pandora: resolveAtlanticStream("pandora"),
  moscow: resolveAtlanticStream("moscow"),
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

// Drop sources past this deadline so the availability route stays within maxDuration.
const PROBE_DEADLINE_MS = 15_000;
const AVAILABILITY_TTL_MS = 2 * 60 * 1000;
const availabilityCache = createTtlCache<PlaybackSource[]>(AVAILABILITY_TTL_MS);

export function isPlaybackSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && (PLAYBACK_SOURCES as readonly string[]).includes(value);
}

// Register streams, subtitle tracks and quality renditions with their required proxy headers.
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

// Height of the source's best rendition, 0 when unknown, or undefined when unplayable.
async function availableHeight(source: PlaybackSource, params: ResolveParams) {
  const result = await resolvePlaybackSource(source, params);
  const cookie = result.cookieScope && result.url.startsWith(result.cookieScope) ? result.cookie : undefined;
  const probe = await probeManifest(result.url, { referer: result.referer, userAgent: result.userAgent, cookie });
  return probe && Math.max(probe.height, ...(result.sources ?? []).map((item) => item.height || 0));
}

// Resolve sources in parallel and list only those with loadable manifests, tallest rendition first.
// Resolver caches let playback reuse the result without resolving again.
export function availablePlaybackSources(params: ResolveParams): Promise<PlaybackSource[]> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return availabilityCache.get(key, async () => {
    const checks = await Promise.allSettled(
      PLAYBACK_SOURCES.map((source) => withDeadline(availableHeight(source, params), PROBE_DEADLINE_MS)),
    );
    const playable = PLAYBACK_SOURCES.flatMap((source, index) => {
      const check = checks[index];
      return check.status === "fulfilled" && check.value !== undefined ? [{ source, height: check.value }] : [];
    });
    // Array#sort is stable, so equal heights keep PLAYBACK_SOURCES order.
    return playable.sort((a, b) => b.height - a.height).map((item) => item.source);
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
