import type { ResolveParams } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import { parseTsCodecs, type StreamTech } from "@/lib/stream-probe";
import { resolveWeCollegeStream } from "@/lib/wecollege";

// Probes cost a resolve, two playlists and 128 KB of video; cache until a provider re-encode is likely.
const TECH_TTL_MS = 6 * 60 * 60 * 1000;
const PROBE_BYTES = 131_072;
const PLAYLIST_TIMEOUT_MS = 8000;

type Upstream = { referer?: string; userAgent?: string };

type StreamTechInfo = StreamTech & { height: number | null };

const cache = createTtlCache<StreamTechInfo>(TECH_TTL_MS);

function firstNonComment(playlist: string) {
  return playlist
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

async function fetchPlaylist(url: string, upstream: Upstream) {
  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      ...(upstream.referer ? { referer: upstream.referer, origin: new URL(upstream.referer).origin } : {}),
      "user-agent": upstream.userAgent ?? "Mozilla/5.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(PLAYLIST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
  return response.text();
}

async function probeStreamTech(params: ResolveParams): Promise<StreamTechInfo> {
  const stream = await resolveWeCollegeStream(params);
  const upstream: Upstream = { referer: stream.referer, userAgent: stream.userAgent };

  const top = stream.sources?.length
    ? stream.sources.reduce((a, b) => (b.height > a.height ? b : a))
    : null;
  let height = top?.height ?? null;
  let playlistUrl = top?.file ?? stream.url;
  let playlist = await fetchPlaylist(playlistUrl, upstream);

  if (playlist.includes("#EXT-X-STREAM-INF")) {
    const heights = [...playlist.matchAll(/RESOLUTION=\d+x(\d+)/g)].map((m) => Number(m[1]));
    if (height === null && heights.length) height = Math.max(...heights);

    const variant = firstNonComment(playlist);
    if (!variant) throw new Error("Master playlist has no variant.");
    playlistUrl = new URL(variant, playlistUrl).href;
    playlist = await fetchPlaylist(playlistUrl, upstream);
  }

  const segment = firstNonComment(playlist);
  if (!segment) throw new Error("Playlist has no segment.");

  const response = await fetch(new URL(segment, playlistUrl), {
    headers: {
      accept: "*/*",
      ...(upstream.referer ? { referer: upstream.referer, origin: new URL(upstream.referer).origin } : {}),
      "user-agent": upstream.userAgent ?? "Mozilla/5.0",
      range: `bytes=0-${PROBE_BYTES - 1}`,
    },
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
