import type { ResolverResult } from "@/lib/videasy";
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

// Keep provider headers server-side; attach them in the proxy, never in JSON responses.
export type Upstream = { referer?: string; userAgent?: string };
export type ResolvedStream = ResolverResult & Upstream & { cookie?: string; cookieScope?: string };

export function httpUrl(value: unknown, base?: string | URL): string | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const url = new URL(value, base);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch { /* Invalid provider URLs are discarded. */ }
}

// Length of a finished stream: an ENDLIST media playlist or a static MPD.
// Live, master or unreadable manifests give undefined.
export function finishedStreamSeconds(manifest: string): number | undefined {
  if (manifest.includes("<MPD")) {
    if (/type="dynamic"/.test(manifest)) return;
    const duration = /mediaPresentationDuration="PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?"/.exec(manifest);
    return duration ? Number(duration[1] ?? 0) * 3600 + Number(duration[2] ?? 0) * 60 + Number(duration[3] ?? 0) : undefined;
  }
  if (!manifest.includes("#EXT-X-ENDLIST")) return;
  return [...manifest.matchAll(/#EXTINF:([\d.]+)/g)].reduce((total, match) => total + Number(match[1]), 0);
}

// Tallest rendition a master or MPD advertises; 0 when it lists none, as media playlists do.
export function manifestHeight(manifest: string): number {
  const heights = [...manifest.matchAll(/RESOLUTION=\d+x(\d+)|<Representation\b[^>]*\bheight="(\d+)"/g)].map(
    (match) => Number(match[1] ?? match[2]),
  );
  return Math.max(0, ...heights);
}

// Reject failed manifests and short decoys; probe a master's first variant but tolerate an unreadable variant.
// Resolve to the advertised height when playable. Apply private-network checks to every third-party URL.
export async function probeManifest(
  url: string,
  upstream: Upstream & { cookie?: string } = {},
): Promise<{ height: number } | undefined> {
  const headers = new Headers({ accept: "*/*", "user-agent": upstream.userAgent ?? BROWSER_USER_AGENT });
  if (upstream.referer) {
    headers.set("referer", upstream.referer);
    headers.set("origin", new URL(upstream.referer).origin);
  }
  if (upstream.cookie) headers.set("cookie", upstream.cookie);
  const load = async (target: string) => {
    const response = await fetchPublic(target, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return undefined;
    }
    return {
      text: (await readCapped(response, MAX_MANIFEST_BYTES)).replace(/^\uFEFF/, "").trimStart(),
      url: response.url || target,
    };
  };
  try {
    const manifest = await load(url);
    if (!manifest || !(manifest.text.startsWith("#EXTM3U") || manifest.text.includes("<MPD"))) return;
    let playlist = manifest.text;
    if (playlist.includes("#EXT-X-STREAM-INF")) {
      const variant = playlist.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("#"));
      const target = variant ? httpUrl(variant, manifest.url) : undefined;
      playlist = (target && (await load(target).catch(() => undefined))?.text) || "";
    }
    const seconds = finishedStreamSeconds(playlist);
    if (seconds === undefined || seconds >= MIN_STREAM_SECONDS) return { height: manifestHeight(manifest.text) };
  } catch { /* Unreachable manifests are unplayable. */ }
}

export async function isPlayableManifest(url: string, upstream: Upstream & { cookie?: string } = {}) {
  return (await probeManifest(url, upstream)) !== undefined;
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
