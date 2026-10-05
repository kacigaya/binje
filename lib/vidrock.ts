import type { ResolveParams } from "@/lib/resolve-cache";
import { fetchJson, firstInOrder, httpUrl, isPlayableManifest, isRecord, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// Vidrock's own API encrypts its server list. The 02pcembed API behind Vidlux
// resolves the same servers in plain JSON, but wraps every URL in its own
// relay; the target and its headers are unwrapped so playback goes through
// b!nje's proxy instead of a third-party one.
const API = "https://02pcembed.site";
const PLAYER = "https://vidlux.xyz/";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

type Target = { url: string; referer?: string; userAgent?: string };

export function unwrapRelay(value: unknown): Target | undefined {
  const url = httpUrl(value);
  if (!url) return;
  const relay = new URL(url);
  if (relay.origin !== API || relay.pathname !== "/v1/proxy") return { url };
  try {
    const data: unknown = JSON.parse(relay.searchParams.get("data") ?? "");
    if (!isRecord(data)) return;
    const target = httpUrl(data.url);
    if (!target) return;
    const headers = isRecord(data.headers) ? data.headers : {};
    return {
      url: target,
      referer: httpUrl(headers.Referer),
      userAgent: typeof headers["User-Agent"] === "string" ? headers["User-Agent"] : undefined,
    };
  } catch {
    return;
  }
}

export function vidrockStreams(body: unknown) {
  if (!isRecord(body)) return { streams: [], tracks: [] };
  const streams = Array.isArray(body.sources)
    ? body.sources.flatMap((source: unknown) =>
        isRecord(source) && (source.type === undefined || source.type === "hls") ? (unwrapRelay(source.url) ?? []) : [],
      )
    : [];
  const tracks = Array.isArray(body.subtitles)
    ? body.subtitles.flatMap((subtitle: unknown) => {
        if (!isRecord(subtitle) || (subtitle.format !== undefined && subtitle.format !== "vtt")) return [];
        const file = unwrapRelay(subtitle.url)?.url;
        return file ? [{ file, label: typeof subtitle.label === "string" ? subtitle.label : undefined }] : [];
      })
    : [];
  return { streams, tracks };
}

export function resolveVidrockStream({ type, id, season, episode }: ResolveParams): Promise<ResolvedStream> {
  const path = type === "tv" ? `tv/${id}/seasons/${season}/episodes/${episode}` : `movies/${id}`;
  return cache.get(path, async () => {
    const body = await fetchJson(`${API}/v1/vidrock/${path}`, { referer: PLAYER, headers: { origin: PLAYER.slice(0, -1) } });
    const { streams, tracks } = vidrockStreams(body);
    const stream = await firstInOrder(
      streams.map(async (stream) => {
        if (!(await isPlayableManifest(stream.url, stream))) throw new Error("Unplayable stream.");
        return stream;
      }),
    );
    return { url: stream.url, tracks, referer: stream.referer, userAgent: stream.userAgent };
  });
}
