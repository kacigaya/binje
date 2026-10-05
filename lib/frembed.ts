import { preferredStreamPaths, scrapeM3u8 } from "@/app/api/resolve-vf/uqload";
import type { ResolveParams } from "@/lib/resolve-cache";
import { BROWSER_USER_AGENT, fetchText, httpUrl, isPlayableManifest, isRecord, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const FREMBED_ORIGIN = "https://frembed.casa";

const BASE_HEADERS = {
  "user-agent": BROWSER_USER_AGENT,
  referer: `${FREMBED_ORIGIN}/`,
};

async function resolveHoster(streamPath: string): Promise<string | null> {
  const res = await fetch(`${FREMBED_ORIGIN}${streamPath}`, {
    headers: BASE_HEADERS,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  return res.headers.get("location");
}

async function extractFromHoster(embedUrl: string): Promise<ResolvedStream | null> {
  const origin = new URL(embedUrl).origin;
  // The hoster URL comes from Frembed's redirect, so it goes through the guard.
  const html = await fetchText(embedUrl, { referer: `${origin}/` });
  const url = httpUrl(scrapeM3u8(html));
  const referer = `${origin}/`;
  return url && (await isPlayableManifest(url, { referer })) ? { url, tracks: [], referer } : null;
}

async function extract({ type, id, season, episode }: ResolveParams): Promise<ResolvedStream> {
  const listUrl =
    type === "tv"
      ? `${FREMBED_ORIGIN}/api/series?id=${id}&sa=${season}&epi=${episode}&idType=tmdb`
      : `${FREMBED_ORIGIN}/api/films?id=${id}&idType=tmdb`;
  const meta: unknown = await fetch(listUrl, {
    headers: BASE_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.json());

  const paths = isRecord(meta) ? preferredStreamPaths(meta) : [];
  if (!paths.length) throw new Error("No VF servers available.");

  for (const path of paths) {
    const hoster = await resolveHoster(path);
    if (!hoster) continue;
    const stream = await extractFromHoster(hoster).catch(() => null);
    if (stream) return stream;
  }
  throw new Error("No VF server returned a stream.");
}

// Walking the hoster list costs one request per candidate server plus a
// playability check, so repeat viewers of the same episode reuse the answer.
// Short window: the hoster URLs expire.
const VF_TTL_MS = 10 * 60 * 1000;
const vfCache = createTtlCache<ResolvedStream>(VF_TTL_MS);

export function resolveFrembedStream(params: ResolveParams): Promise<ResolvedStream> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return vfCache.get(key, () => extract(params));
}
