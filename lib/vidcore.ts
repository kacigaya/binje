import { firstInOrder, httpUrl, isRecord, probeManifest, resolveKey, type ResolveParams, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const REFERER = "https://vidcore.io/";
const MAX_PLAYLISTS = 5;
const cache = createTtlCache<ResolvedStream>(5 * 60 * 1000);

// The local browser service runs Vidcore's rotating request code through Gluetun.
export function resolveVidcoreStream(params: ResolveParams): Promise<ResolvedStream> {
  return cache.get(resolveKey(params), async () => {
    const endpoint = httpUrl(process.env.VIDCORE_RESOLVER_URL);
    const token = process.env.VIDCORE_RESOLVER_TOKEN;
    if (!endpoint || !token) throw new Error("Vidcore browser resolver is not configured.");

    // Share one deadline for browser and CDN checks, below /api/sources' 15-second limit.
    const signal = AbortSignal.timeout(13_000);
    const { type, id, season, episode } = params;
    const response = await fetch(new URL("resolve", endpoint.endsWith("/") ? endpoint : `${endpoint}/`), {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, id, ...(type === "tv" ? { season, episode } : {}) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Vidcore browser resolver failed.");
    }
    const body: unknown = await response.json();
    // Older resolver scripts return only `url`; newer ones add the player's fallback servers as `urls`.
    const listed = isRecord(body) ? (Array.isArray(body.urls) ? body.urls : [body.url]) : [];
    const urls = [...new Set(listed.map((value) => httpUrl(value)).filter((url) => url !== undefined))].slice(0, MAX_PLAYLISTS);
    const stream = await firstInOrder(urls.map(async (url) => {
      const probe = await probeManifest(url, REFERER, signal);
      if (!probe) throw new Error("Unplayable stream.");
      return { url, height: probe.height };
    })).catch(() => {
      throw new Error("Vidcore has no playable stream.");
    });
    return { ...stream, referer: REFERER, tracks: [] };
  });
}
