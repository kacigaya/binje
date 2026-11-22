import { httpUrl, isRecord, probeManifest, resolveKey, type ResolveParams, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const REFERER = "https://vidcore.io/";
const cache = createTtlCache<ResolvedStream>(5 * 60 * 1000);

async function probeCandidate(body: unknown, signal: AbortSignal): Promise<ResolvedStream | undefined> {
  const url = isRecord(body) ? httpUrl(body.url) : undefined;
  if (!url) return;
  const referer = isRecord(body) && body.noReferrer === true ? undefined : REFERER;
  const probe = await probeManifest(url, referer, signal);
  if (probe) return { url, referer, tracks: [], height: probe.height };
}

async function firstPlayable(response: Response, signal: AbortSignal): Promise<ResolvedStream | undefined> {
  if (response.headers.get("content-type")?.split(";")[0] !== "application/x-ndjson") {
    return probeCandidate(await response.json(), signal);
  }

  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffered = "";
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return buffered.trim() ? await probeCandidate(JSON.parse(buffered + decoder.decode()), signal) : undefined;
      }
      received += value.byteLength;
      if (received > 64 * 1024) throw new Error("Vidcore resolver response is too large.");
      buffered += decoder.decode(value, { stream: true });
      let end = buffered.indexOf("\n");
      while (end !== -1) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 1);
        if (line.trim()) {
          const stream = await probeCandidate(JSON.parse(line), signal);
          if (stream) return stream;
        }
        end = buffered.indexOf("\n");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

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
    const stream = await firstPlayable(response, signal);
    if (!stream) throw new Error("Vidcore has no playable stream.");
    return stream;
  });
}
