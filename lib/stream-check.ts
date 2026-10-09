import type { ResolverResult } from "@/lib/videasy";
import { fetchPublic } from "@/lib/safe-fetch";

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const CHECK_TIMEOUT_MS = 6000;
// Masters, media playlists and DASH manifests fit well inside these; a larger
// body is not a manifest, and provider pages are a few hundred KB at most.
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

// Reads at most maxBytes so a provider answering with a video file cannot make
// the server buffer all of it.
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

// Upstream headers a resolver hands back stay on the server: the proxy
// attaches them, the JSON response never carries them.
export type Upstream = { referer?: string; userAgent?: string };
export type ResolvedStream = ResolverResult & Upstream & { cookie?: string; cookieScope?: string };

export function httpUrl(value: unknown, base?: string | URL): string | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const url = new URL(value, base);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch { /* Invalid provider URLs are discarded. */ }
}

// A signed URL can still be dead: a 403, an HTML error page, or a CDN that
// refuses this server. Only a manifest that loads counts as available. The
// URL comes from a third party, so it gets the proxy's private-network guard.
export async function isPlayableManifest(url: string, upstream: Upstream & { cookie?: string } = {}) {
  const headers = new Headers({ accept: "*/*", "user-agent": upstream.userAgent ?? BROWSER_USER_AGENT });
  if (upstream.referer) {
    headers.set("referer", upstream.referer);
    headers.set("origin", new URL(upstream.referer).origin);
  }
  if (upstream.cookie) headers.set("cookie", upstream.cookie);
  try {
    const response = await fetchPublic(url, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const text = (await readCapped(response, MAX_MANIFEST_BYTES)).replace(/^\uFEFF/, "").trimStart();
    return text.startsWith("#EXTM3U") || text.includes("<MPD");
  } catch {
    return false;
  }
}

// Probed together so a dead server cannot cost its full timeout; the earliest
// task wins once every task before it has failed.
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

// Some provider requests follow URLs taken from earlier responses (a page's
// base href, a script's host, a redirect), so all of them get the guard.
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
