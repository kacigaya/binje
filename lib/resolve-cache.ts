import { createTtlCache } from "@/lib/ttl-cache";
import { resolveVideasyStream, type ResolverResult } from "@/lib/videasy";

// Reuse resolves across detail and watch pages to save upstream calls; keep TTL short because URLs expire.
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

// Key by TMDB id and episode; title and year only guide provider lookup.
function resolveCacheKey({ type, id, season, episode }: ResolveParams) {
  return type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
}

export function cachedResolveVideasyStream(params: ResolveParams): Promise<ResolverResult> {
  return cache.get(resolveCacheKey(params), () => resolveVideasyStream(params));
}
