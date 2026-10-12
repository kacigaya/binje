import type { ResolveParams } from "@/lib/resolve-cache";
import { isPlayableManifest, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// The Worker behind Rive's "Mirage" server: an unauthenticated HLS master per
// TMDB movie id, 4K H.264 down to 480p. It has no TV paths, and no subtitles.
// It answers 403 to any Referer or Origin, so the proxy is pinned to send none.
const ORIGIN = "https://cine4k.mpddash.workers.dev";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

export function cine4kUrl({ type, id }: Pick<ResolveParams, "type" | "id">): string | undefined {
  return type === "movie" && /^\d+$/.test(id) ? `${ORIGIN}/movie/${id}.m3u8` : undefined;
}

export function resolveCine4kStream(params: ResolveParams): Promise<ResolvedStream> {
  const url = cine4kUrl(params);
  if (!url) return Promise.reject(new Error("Cine4K has movies only."));
  return cache.get(params.id, async () => {
    if (!(await isPlayableManifest(url))) throw new Error("Cine4K has no stream.");
    return { url, tracks: [], referer: "" };
  });
}
