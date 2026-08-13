import { cachedResolveVideasyStream, type ResolveParams } from "@/lib/resolve-cache";
import { createTtlCache } from "@/lib/ttl-cache";
import { parseTsCodecs, type StreamTech } from "@/lib/stream-probe";

// The badges describe the stream a title ships with, which only changes when
// the provider re-encodes it. Probing costs a resolve plus two playlists plus
// 128 KB of transport stream, so the answer is worth holding for a long time.
const TECH_TTL_MS = 6 * 60 * 60 * 1000;
const PROBE_BYTES = 131_072;
const PLAYER_ORIGIN = "https://player.videasy.to";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const PLAYLIST_TIMEOUT_MS = 8000;

const BASE_HEADERS = {
  accept: "*/*",
  origin: PLAYER_ORIGIN,
  referer: `${PLAYER_ORIGIN}/`,
  "user-agent": BROWSER_USER_AGENT,
};

export type StreamTechInfo = StreamTech & { height: number | null };

const cache = createTtlCache<StreamTechInfo>(TECH_TTL_MS);

function firstNonComment(playlist: string) {
  return playlist
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

async function fetchPlaylist(url: string) {
  const response = await fetch(url, {
    headers: BASE_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(PLAYLIST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
  return response.text();
}

async function probeStreamTech(params: ResolveParams): Promise<StreamTechInfo> {
  const stream = await cachedResolveVideasyStream(params);

  const top = stream.sources?.length
    ? stream.sources.reduce((a, b) => (b.height > a.height ? b : a))
    : null;
  let height = top?.height ?? null;
  let playlistUrl = top?.file ?? stream.url;
  let playlist = await fetchPlaylist(playlistUrl);

  if (playlist.includes("#EXT-X-STREAM-INF")) {
    const heights = [...playlist.matchAll(/RESOLUTION=\d+x(\d+)/g)].map((m) => Number(m[1]));
    if (height === null && heights.length) height = Math.max(...heights);

    const variant = firstNonComment(playlist);
    if (!variant) throw new Error("Master playlist has no variant.");
    playlistUrl = new URL(variant, playlistUrl).href;
    playlist = await fetchPlaylist(playlistUrl);
  }

  const segment = firstNonComment(playlist);
  if (!segment) throw new Error("Playlist has no segment.");

  const response = await fetch(new URL(segment, playlistUrl), {
    headers: { ...BASE_HEADERS, range: `bytes=0-${PROBE_BYTES - 1}` },
    cache: "no-store",
    signal: AbortSignal.timeout(PLAYLIST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Segment request failed: ${response.status}`);

  // A server that ignores Range would otherwise stream the whole segment.
  const buffer = (await response.arrayBuffer()).slice(0, PROBE_BYTES);
  return { height, ...parseTsCodecs(new Uint8Array(buffer)) };
}

export function getStreamTech(params: ResolveParams): Promise<StreamTechInfo> {
  const key =
    params.type === "tv"
      ? `tv:${params.id}:${params.season}:${params.episode}`
      : `movie:${params.id}`;
  return cache.get(key, () => probeStreamTech(params));
}
