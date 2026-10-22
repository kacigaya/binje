import { allowStreamHost, allowStreamHosts } from "@/lib/hls-hosts";
import { probeManifest, resolveKey, type ResolvedStream, type ResolveParams } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import type { PlaybackSource } from "@/types/mobile-api";
import { resolveVidmeStream } from "@/lib/vidme";
import { resolveVidruStream } from "@/lib/vidru";
import { resolveVidsuStream } from "@/lib/vidsu";

export type { PlaybackSource };

// Nightflix's servers in its own order. Failover tries the tallest advertised rendition first;
// equal heights keep this order. Vidcore is missing: its stream endpoint fails for every title.
export const PLAYBACK_SOURCES = ["vidsu", "vidme", "vidru"] as const satisfies readonly PlaybackSource[];

const RESOLVERS: Record<PlaybackSource, (params: ResolveParams) => Promise<ResolvedStream>> = {
  vidsu: resolveVidsuStream,
  vidme: resolveVidmeStream,
  vidru: resolveVidruStream,
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
  allowStreamHost(result.url, result.referer);
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
  const probe = await probeManifest(result.url, result.referer);
  return probe && Math.max(probe.height, ...(result.sources ?? []).map((item) => item.height || 0));
}

// Resolve sources in parallel and list only those with loadable manifests, tallest rendition first.
// Resolver caches let playback reuse the result without resolving again.
export function availablePlaybackSources(params: ResolveParams): Promise<PlaybackSource[]> {
  return availabilityCache.get(resolveKey(params), async () => {
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
