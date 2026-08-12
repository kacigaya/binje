import { createTtlCache } from "@/lib/ttl-cache";
import { parseTsCodecs, type StreamTech } from "@/lib/stream-probe";
import { resolveVideasyStream } from "@/lib/videasy";

export type StreamTechInfo = StreamTech & { height: number | null };
export type StreamTechParams = {
  type: "movie" | "tv";
  id: string;
  title: string;
  year: string;
  imdbId: string;
  season: string;
  episode: string;
};

const cache = createTtlCache<StreamTechInfo>(6 * 60 * 60 * 1000);
const HEADERS = {
  accept: "*/*",
  origin: "https://player.videasy.to",
  referer: "https://player.videasy.to/",
};

function firstMediaLine(playlist: string) {
  return playlist.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("#"));
}

async function fetchPlaylist(url: string) {
  const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
  return response.text();
}

async function probe(params: StreamTechParams): Promise<StreamTechInfo> {
  const stream = await resolveVideasyStream(params);
  const top = stream.sources?.length
    ? stream.sources.reduce((a, b) => (b.height > a.height ? b : a))
    : null;
  let height = top?.height ?? null;
  let playlistUrl = top?.file ?? stream.url;
  let playlist = await fetchPlaylist(playlistUrl);

  if (playlist.includes("#EXT-X-STREAM-INF")) {
    const heights = [...playlist.matchAll(/RESOLUTION=\d+x(\d+)/g)].map((match) => Number(match[1]));
    if (height === null && heights.length) height = Math.max(...heights);
    const variant = firstMediaLine(playlist);
    if (!variant) throw new Error("Master playlist has no variant");
    playlistUrl = new URL(variant, playlistUrl).href;
    playlist = await fetchPlaylist(playlistUrl);
  }

  const segment = firstMediaLine(playlist);
  if (!segment) throw new Error("Playlist has no segment");
  const response = await fetch(new URL(segment, playlistUrl), {
    headers: { ...HEADERS, range: "bytes=0-131071" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Segment request failed: ${response.status}`);
  const buffer = (await response.arrayBuffer()).slice(0, 131072);
  return { height, ...parseTsCodecs(new Uint8Array(buffer)) };
}

export function getStreamTech(params: StreamTechParams) {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return cache.get(key, () => probe(params));
}
