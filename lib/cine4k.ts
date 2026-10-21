import type { ResolveParams } from "@/lib/resolve-cache";
import { isPlayableManifest, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// Rive's Mirage worker serves movie-only HLS from 4K to 480p, without subtitles.
// It rejects any Referer or Origin, so the proxy must send neither.
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
