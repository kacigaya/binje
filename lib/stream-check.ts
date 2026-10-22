import { fetchPublic } from "@/lib/safe-fetch";

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const CHECK_TIMEOUT_MS = 6000;
// Bound manifest and provider-page reads; larger bodies may be video files.
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
// Short finished streams can be decoys, such as Aphrodite's error clip or ViDZY's /troll/ playlist.
const MIN_STREAM_SECONDS = 120;

// Cap reads so a provider returning video cannot make the server buffer the entire file.
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel();
  const bytes = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.byteLength - offset);
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export type ResolveParams = {
  type: "movie" | "tv";
  id: string;
  title: string;
  year: string;
  imdbId: string;
  season: string;
  episode: string;
};

// Key by TMDB id and episode; title and year only guide provider lookup.
export function resolveKey({ type, id, season, episode }: ResolveParams) {
  return type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
}

type Track = { file: string; label?: string };
export type ResolverResult = { url: string; tracks: Track[] };

// Keep provider headers server-side; attach them in the proxy, never in JSON responses.
export type ResolvedStream = ResolverResult & { referer?: string };

export function httpUrl(value: unknown, base?: string | URL): string | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const url = new URL(value, base);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch { /* Invalid provider URLs are discarded. */ }
}

// Length of a finished stream: an ENDLIST media playlist.
// Live, master or unreadable playlists give undefined.
export function finishedStreamSeconds(manifest: string): number | undefined {
  if (!manifest.includes("#EXT-X-ENDLIST")) return;
  return [...manifest.matchAll(/#EXTINF:([\d.]+)/g)].reduce((total, match) => total + Number(match[1]), 0);
}

// Tallest rendition a master playlist advertises; 0 when it lists none, as media playlists do.
export function manifestHeight(manifest: string): number {
  return Math.max(0, ...[...manifest.matchAll(/RESOLUTION=\d+x(\d+)/g)].map((match) => Number(match[1])));
}

function uris(playlist: string) {
  return playlist.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

// Reject failed manifests, short decoys and streams whose middle segment fails, such as
// previews that stop after a minute. Probe a master's first variant but tolerate an unreadable
// variant. Resolve to the advertised height when playable. Apply private-network checks to every URL.
export async function probeManifest(
  url: string,
  referer?: string,
): Promise<{ height: number } | undefined> {
  const headers = new Headers({ accept: "*/*", "user-agent": BROWSER_USER_AGENT });
  if (referer) {
    headers.set("referer", referer);
    headers.set("origin", new URL(referer).origin);
  }
  const request = (target: string) =>
    fetchPublic(target, { cache: "no-store", headers, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
  const load = async (target: string) => {
    const response = await request(target);
    if (!response.ok) {
      await response.body?.cancel();
      return undefined;
    }
    return {
      text: (await readCapped(response, MAX_MANIFEST_BYTES)).replace(/^\uFEFF/, "").trimStart(),
      url: response.url || target,
    };
  };
  // Read one chunk, not the segment: disguised segments can be several megabytes.
  // Range is optional for HLS servers, so the request does not ask for one.
  const segmentLoads = async (target: string) => {
    const response = await request(target);
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body?.getReader();
    const chunk = await reader?.read();
    await reader?.cancel();
    return Boolean(chunk && !chunk.done);
  };
  try {
    const manifest = await load(url);
    if (!manifest?.text.startsWith("#EXTM3U")) return;
    let media: { text: string; url: string } | undefined = manifest;
    if (manifest.text.includes("#EXT-X-STREAM-INF")) {
      const target = httpUrl(uris(manifest.text)[0], manifest.url);
      media = target ? await load(target).catch(() => undefined) : undefined;
      if (!media?.text.startsWith("#EXTM3U")) media = undefined;
    }
    if (media) {
      const seconds = finishedStreamSeconds(media.text);
      if (seconds !== undefined && seconds < MIN_STREAM_SECONDS) return;
      const segments = uris(media.text);
      const middle = httpUrl(segments[Math.floor(segments.length / 2)], media.url);
      if (segments.length && !(middle && (await segmentLoads(middle)))) return;
    }
    return { height: manifestHeight(manifest.text) };
  } catch { /* Unreachable manifests and segments are unplayable. */ }
}

export async function isPlayableManifest(url: string, referer?: string) {
  return (await probeManifest(url, referer)) !== undefined;
}

export type StreamCandidate = { url: string; referer?: string };

// The first candidate whose manifest plays, probed concurrently but chosen in list order.
export function firstPlayable(candidates: StreamCandidate[]): Promise<StreamCandidate> {
  return firstInOrder(
    candidates.map(async (candidate) => {
      if (!(await isPlayableManifest(candidate.url, candidate.referer))) {
        throw new Error("Unplayable stream.");
      }
      return candidate;
    }),
  );
}

// Probe concurrently, but honor order: a result wins only after all earlier tasks fail.
export function firstInOrder<T>(tasks: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const settled: ({ ok: true; value: T } | { ok: false } | undefined)[] = tasks.map(() => undefined);
    let next = 0;
    const advance = () => {
      while (next < tasks.length) {
        const result = settled[next];
        if (!result) return;
        if (result.ok) return resolve(result.value);
        next++;
      }
      reject(new Error("No playable stream."));
    };
    tasks.forEach((task, index) => {
      task.then(
        (value) => {
          settled[index] = { ok: true, value };
          advance();
        },
        () => {
          settled[index] = { ok: false };
          advance();
        },
      );
    });
    advance();
  });
}

export class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`Upstream answered ${status}.`);
    this.name = "UpstreamError";
  }
}

// Guard URLs from provider responses too, including base hrefs, script hosts and redirects.
export async function fetchText(url: string, init: { referer?: string; userAgent?: string; headers?: Record<string, string> } = {}) {
  const response = await fetchPublic(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "user-agent": init.userAgent ?? BROWSER_USER_AGENT,
      ...(init.referer ? { referer: init.referer } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(response.status);
  }
  return readCapped(response, MAX_PAGE_BYTES);
}

export async function fetchJson(url: string, init: Parameters<typeof fetchText>[1] = {}): Promise<unknown> {
  return JSON.parse(await fetchText(url, init));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
