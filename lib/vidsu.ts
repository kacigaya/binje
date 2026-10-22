import {
  fetchJson,
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

// The "Vidsu" server (player-4aq.pages.dev) merges three stream APIs keyed by TMDB id.
// Its fourth API, Molvin, is switched off in the player itself.
const PLAYER = "https://player-4aq.pages.dev/";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

// Vidrock puts the Referer its CDN needs into the proxy link beside each original URL.
export function vidrockCandidates(body: unknown): StreamCandidate[] {
  if (!isRecord(body) || !Array.isArray(body.sources)) return [];
  return body.sources.flatMap((source) => {
    if (!isRecord(source) || source.type !== "hls") return [];
    const url = httpUrl(source.original_url);
    const proxy = httpUrl(source.url);
    const referer = proxy ? httpUrl(new URL(proxy).searchParams.get("referer")) : undefined;
    return url ? [{ url, referer }] : [];
  });
}

// Xpass playlists play only through the API's signed proxy, which checks the player's Referer.
export function xpassCandidates(body: unknown): StreamCandidate[] {
  if (!isRecord(body) || !Array.isArray(body.streams)) return [];
  return body.streams.flatMap((stream) => {
    const url = isRecord(stream) && /hls/i.test(String(stream.format)) ? httpUrl(stream.url) : undefined;
    return url ? [{ url, referer: PLAYER }] : [];
  });
}

// Flix2Watch signs one URL: HLS for episodes but MP4 for films, which the HLS player cannot use.
export function flix2watchCandidates(body: unknown): StreamCandidate[] {
  const url = isRecord(body) ? httpUrl(body.signed_url) : undefined;
  return url && new URL(url).pathname.endsWith(".m3u8") ? [{ url }] : [];
}

function backends({ type, id, season, episode }: ResolveParams) {
  const episodeQuery: Record<string, string> = type === "tv" ? { season, episode } : {};
  return [
    fetchJson(`https://themoviebox.uk/api/resolve?${new URLSearchParams({ type, id, ...episodeQuery })}`).then(
      vidrockCandidates,
    ),
    fetchJson(`https://freakyniki.elaxo.lol/?${new URLSearchParams({ tmdb_id: id, ...episodeQuery })}`, {
      referer: PLAYER,
    }).then(xpassCandidates),
    fetchJson(
      type === "tv"
        ? `https://flix2watch.pro/api/tv/${id}/${season}/${episode}`
        : `https://flix2watch.pro/api/movie/${id}`,
    ).then(flix2watchCandidates),
  ];
}

export function resolveVidsuStream(params: ResolveParams): Promise<ResolvedStream> {
  return cache.get(resolveKey(params), async () => {
    // Each API is probed as soon as it answers; a failed or empty API falls through to the next.
    const { url, referer } = await firstInOrder(backends(params).map((list) => list.then(firstPlayable)));
    return { url, tracks: [], referer };
  });
}
