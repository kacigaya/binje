import { createTtlCache } from "@/lib/ttl-cache";
import { resolveVideasyStream, type ResolverResult } from "@/lib/videasy";

// A resolve costs three to six upstream calls (seed, sources, decrypt, plus
// retries and the vsrc fallback). The detail page probes the stream for its
// tech badges and the watch page resolves the same title again seconds later,
// so without this the same chain runs several times per visitor.
// The window stays short because provider URLs are signed and expire.
export const RESOLVE_TTL_MS = 10 * 60 * 1000;

export type ResolveParams = {
  type: "movie" | "tv";
  id: string;
  title: string;
  year: string;
  imdbId: string;
  season: string;
  episode: string;
};

const cache = createTtlCache<ResolverResult>(RESOLVE_TTL_MS);

// Title and year only steer the provider lookup; the stream is identified by
// tmdb id plus episode, so they stay out of the key.
export function resolveCacheKey({ type, id, season, episode }: ResolveParams) {
  return type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
}

export function cachedResolveVideasyStream(params: ResolveParams): Promise<ResolverResult> {
  return cache.get(resolveCacheKey(params), () => resolveVideasyStream(params));
}
