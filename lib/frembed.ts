import { fetchPublic } from "@/lib/safe-fetch";
import {
  BROWSER_USER_AGENT, fetchJson, fetchText, httpUrl, isRecord, probeManifest, resolveKey,
  type ResolveParams, type ResolvedStream,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const FREMBED_ORIGIN = "https://frembed.bar";
const REFERER = `${FREMBED_ORIGIN}/`;
const HOSTERS = ["uqload", "netu"] as const;

export function unpackPacked(source: string): string | null {
  if (source.length > 256 * 1024) return null;
  const m = source.match(
    /\}\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/,
  );
  if (!m) return null;
  let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const radix = Number(m[2]);
  let count = Number(m[3]);
  const dict = m[4].split("|");
  if (radix < 2 || radix > 36 || !Number.isSafeInteger(count) || count > 2048 || count > dict.length ||
      payload.length > 32 * 1024 || dict.some((word) => word.length > 256)) return null;
  let work = 0;
  while (count--) {
    // Bound scanning and expansion while preserving the hoster's radix-word replacement order.
    work += payload.length;
    if (work > 16 * 1024 * 1024) return null;
    if (dict[count]) {
      payload = payload.replace(
        new RegExp("\\b" + count.toString(radix) + "\\b", "g"),
        dict[count],
      );
      if (payload.length > 32 * 1024) return null;
    }
  }
  return payload;
}

export function extractM3u8(embedHtml: string): string | null {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
  return m ? m[1] : null;
}

export function scrapeM3u8(embedHtml: string): string | null {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/https?:\/\/[^"'\s\\)]+\.m3u8[^"'\s\\)]*/);
  return m ? m[0] : null;
}

function streamPath(value: unknown): string | undefined {
  const url = httpUrl(value, FREMBED_ORIGIN);
  if (!url) return;
  const parsed = new URL(url);
  if (parsed.origin === FREMBED_ORIGIN && parsed.pathname === "/api/stream") return url;
}

export function preferredStreamPaths(meta: Record<string, unknown>, audio: "vf" | "vostfr" = "vf"): string[] {
  const links = Array.isArray(meta.links) ? meta.links.filter(isRecord) : [];
  const paths: string[] = [];
  // Modern entries carry language and host metadata. Never walk browser-only hosters.
  for (const hoster of HOSTERS) {
    const matching = links.filter((link) => link.lang === audio && isRecord(link.host) && link.host.slug === hoster);
    matching.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
    for (const link of matching) {
      const path = streamPath(link.url);
      if (path) paths.push(path);
    }
  }
  const knownPaths = new Set(links.map((link) => streamPath(link.url)).filter(Boolean));
  for (let slot = 1; slot <= 7; slot++) {
    const path = streamPath(meta[`link${slot}${audio === "vostfr" ? "vostfr" : ""}`]);
    // Older slots have no host metadata; inspect their redirect before fetching the embed.
    if (path && !knownPaths.has(path)) paths.push(path);
  }
  return [...new Set(paths)];
}

function hosterReferer(embedUrl: string): string | undefined {
  const origin = new URL(embedUrl).origin;
  if (origin === "https://uqload.vc") return "https://uqload.vc/";
  if (origin === "https://netu.frembed.bond") return "https://netu.frembed.bond/";
}

async function resolveHoster(path: string, signal: AbortSignal): Promise<ResolvedStream | undefined> {
  const response = await fetchPublic(path, {
    headers: { "user-agent": BROWSER_USER_AGENT, referer: REFERER },
    redirect: "manual",
    cache: "no-store",
    signal,
  });
  const embedUrl = response.status >= 300 && response.status < 400
    ? httpUrl(response.headers.get("location"), path) : undefined;
  await response.body?.cancel();
  if (!embedUrl) return;
  const referer = hosterReferer(embedUrl);
  if (!referer) return;
  const html = await fetchText(embedUrl, { referer, signal });
  const url = httpUrl(scrapeM3u8(html));
  if (!url) return;
  const probe = await probeManifest(url, referer, signal);
  if (probe) return { url, tracks: [], referer, height: probe.height };
}

async function extract(params: ResolveParams): Promise<ResolvedStream> {
  const { type, id, season, episode, audio = "vf" } = params;
  const signal = AbortSignal.timeout(14_000);
  const query = new URLSearchParams({ id, idType: "tmdb" });
  if (type === "tv") {
    query.set("sa", season);
    query.set("epi", episode);
  }
  const meta = await fetchJson(`${FREMBED_ORIGIN}/api/${type === "tv" ? "series" : "films"}?${query}`, { referer: REFERER, signal });
  const paths = isRecord(meta) ? preferredStreamPaths(meta, audio) : [];
  for (const path of paths) {
    signal.throwIfAborted();
    const stream = await resolveHoster(path, signal).catch(() => undefined);
    if (stream) return stream;
  }
  throw new Error("No Frembed server returned a playable stream.");
}

// Signed hoster URLs expire. Share hoster walks for five minutes, per audio lane.
const cache = createTtlCache<ResolvedStream>(5 * 60 * 1000);

export function resolveFrembedStream(params: ResolveParams): Promise<ResolvedStream> {
  return cache.get(resolveKey({ ...params, audio: params.audio ?? "vf" }), () => extract(params));
}
