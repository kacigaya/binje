import { createTtlCache } from "@/lib/ttl-cache";
import { resolveVideasyStream, type ResolverResult } from "@/lib/videasy";

// Detail and watch pages resolve the same title seconds apart, and a resolve
// costs three to six upstream calls. Short window: provider URLs expire.
const RESOLVE_TTL_MS = 10 * 60 * 1000;

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
function resolveCacheKey({ type, id, season, episode }: ResolveParams) {
  return type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
}

export function cachedResolveVideasyStream(params: ResolveParams): Promise<ResolverResult> {
  return cache.get(resolveCacheKey(params), () => resolveVideasyStream(params));
}
