import {
  fetchJson,
  fetchText,
  firstInOrder,
  firstPlayable,
  httpUrl,
  isRecord,
  resolveKey,
  type ResolveParams,
  type ResolvedStream,
  type StreamCandidate,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// Nightflix's "Vidme" server. vidzen.fun signs its API with a token from the watch page and
// proxies every stream under /api/stream/, which answers only with its own Referer.
const SITE = "https://vidzen.fun";
const REFERER = `${SITE}/`;
// The player's server ids in its own order. Proxima is left out: it answers HEVC DASH or nothing.
const SERVERS = [
  "hyperion",
  "mars",
  "jupiter",
  "venus",
  "saturn",
  "mercury",
  "neptune",
  "earth",
  "uranus",
  "pluto",
  "helios",
] as const;
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

// The token sits in the page's React Server Components payload, where quotes are escaped.
export function pageToken(html: string): string | undefined {
  return /\\?"apiToken\\?":\\?"([\w.-]+)/.exec(html)?.[1];
}

// Servers also answer MP4 and DASH; only HLS plays here.
export function vidmeCandidates(body: unknown): StreamCandidate[] {
  if (!isRecord(body) || !Array.isArray(body.sources)) return [];
  return body.sources.flatMap((source) => {
    const url = isRecord(source) && source.type === "hls" ? httpUrl(source.url, SITE) : undefined;
    return url ? [{ url, referer: REFERER }] : [];
  });
}

export function resolveVidmeStream(params: ResolveParams): Promise<ResolvedStream> {
  return cache.get(resolveKey(params), async () => {
    const { type, id, season, episode } = params;
    const path = type === "tv" ? `tv/${id}/${season}/${episode}` : `movie/${id}`;
    const token = pageToken(await fetchText(`${SITE}/${path}`));
    if (!token) throw new Error("Vidme has no token.");
    const query = (server: string) =>
      new URLSearchParams({ type, id, ...(type === "tv" ? { season, episode } : {}), server, token });
    const { url, referer } = await firstInOrder(
      SERVERS.map((server) =>
        fetchJson(`${SITE}/api/sources?${query(server)}`, { referer: REFERER }).then(vidmeCandidates).then(firstPlayable),
      ),
    );
    return { url, tracks: [], referer };
  });
}
