import { allowStreamHost, allowStreamHosts } from "@/lib/hls-hosts";
import { probeManifest, resolveKey, type ResolvedStream, type ResolveParams } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import type { PlaybackSource } from "@/types/mobile-api";
import { resolveFrembedStream } from "@/lib/frembed";
import { resolveVidmeStream } from "@/lib/vidme";
import { resolveVidruStream } from "@/lib/vidru";
import { resolveVidsuStream } from "@/lib/vidsu";
import { resolveVidcoreStream } from "@/lib/vidcore";
import { PLAYBACK_SOURCES, rankPlaybackSources } from "@/lib/playback-selection";

export type { PlaybackSource };
export { PLAYBACK_SOURCES, isPlaybackSource } from "@/lib/playback-selection";

const RESOLVERS: Record<PlaybackSource, (params: ResolveParams) => Promise<ResolvedStream>> = {
  vidcore: resolveVidcoreStream,
  vidsu: resolveVidsuStream,
  vidme: resolveVidmeStream,
  vidru: resolveVidruStream,
  frembed: resolveFrembedStream,
};

// Drop sources past this deadline so the availability route stays within maxDuration.
const PROBE_DEADLINE_MS = 15_000;
const AVAILABILITY_TTL_MS = 2 * 60 * 1000;
const availabilityCache = createTtlCache<PlaybackSource[]>(AVAILABILITY_TTL_MS);

// Register streams and subtitle tracks with the Referer their hosts need.
export async function resolvePlaybackSource(source: PlaybackSource, params: ResolveParams): Promise<ResolvedStream> {
  const result = await RESOLVERS[source](params);
  allowStreamHost(result.url, result.referer);
  allowStreamHosts(result.tracks.map((track) => track.file));
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
  if (result.height !== undefined) return result.height;
  const probe = await probeManifest(result.url, result.referer);
  return probe?.height;
}

// Rank playable sources by quality. Resolver caches let playback reuse these results.
export function availablePlaybackSources(params: ResolveParams, audio: "vo" | "vf" = "vo"): Promise<PlaybackSource[]> {
  const sources = audio === "vf" ? ["frembed"] as const : PLAYBACK_SOURCES.filter((source) => source !== "frembed");
  return availabilityCache.get(`${resolveKey(params)}:${audio}`, async () => {
    const checks = await Promise.allSettled(
      sources.map((source) => withDeadline(availableHeight(source, params), PROBE_DEADLINE_MS)),
    );
    const heights: Partial<Record<PlaybackSource, number>> = {};
    sources.forEach((source, index) => {
      const check = checks[index];
      if (check.status === "fulfilled" && check.value !== undefined) heights[source] = check.value;
    });
    return rankPlaybackSources(heights);
  });
}

// The title query shared by /api/resolve and /api/sources; null when invalid.
export function parseResolveParams(query: URLSearchParams): ResolveParams | null {
  const type = query.get("type");
  const audio = query.get("audio");
  const id = query.get("id") ?? "";
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  if (
    (audio !== null && audio !== "vf" && audio !== "vostfr") ||
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
  return { type, id, title, year, imdbId, season, episode, ...(audio ? { audio } : {}) };
}
