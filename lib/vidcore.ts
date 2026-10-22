import { httpUrl, isRecord, probeManifest, resolveKey, type ResolveParams, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const REFERER = "https://vidcore.io/";
const cache = createTtlCache<ResolvedStream>(5 * 60 * 1000);

// The local browser service runs Vidcore's rotating request code through Gluetun.
export function resolveVidcoreStream(params: ResolveParams): Promise<ResolvedStream> {
  return cache.get(resolveKey(params), async () => {
    const endpoint = httpUrl(process.env.VIDCORE_RESOLVER_URL);
    const token = process.env.VIDCORE_RESOLVER_TOKEN;
    if (!endpoint || !token) throw new Error("Vidcore browser resolver is not configured.");

    // Browser resolution and CDN validation share one deadline below /api/sources' 15 seconds.
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
    const url = isRecord(body) ? httpUrl(body.url) : undefined;
    const probe = url ? await probeManifest(url, REFERER, signal) : undefined;
    if (!url || !probe) throw new Error("Vidcore has no playable stream.");
    return { url, referer: REFERER, tracks: [], height: probe.height };
  });
}
