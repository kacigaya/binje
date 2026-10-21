import { fetchText, isRecord, type ResolveParams, type ResolvedStream, type Track } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// WeCollege answers the same catalog for Movy and Vidy. Its API is public and
// needs no site page: one seed per media id, then one call per server. The
// answer is encrypted with the stream cipher the players use, and the media
// hosts only answer requests that carry the Movy referer.
const API = "https://api.wecollege.net";
const REFERER = "https://www.movy.sx/";
const PAYLOAD_MARKER = new Uint8Array([0x6d, 0x76, 0x6d, 0x31]);
const GOLDEN_RATIO = 0x9e3779b9;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

// Miami and Boise carry the 4K ladder; the rest top out at 1080p or less.
// Reno and Orlando answer 500 while their upstream is down, so they come last.
const SERVERS = [
  "miami",
  "boise",
  "vegas",
  "oakland",
  "seattle",
  "phoenix",
  "atlanta",
  "portland",
  "dallas",
  "tampa",
  "munich",
  "berlin",
  "paris",
  "cancun",
  "austin",
  "delhi",
  "reno",
  "orlando",
] as const;

const SERVER_BATCH_SIZE = 4;
const MAX_PROBES = 6;
const RESOLVE_TTL_MS = 10 * 60 * 1000;
// The seed lives about half a minute upstream, but the endpoint rate limits
// hard, so a seed is kept far longer and refreshed only when it is rejected.
const SEED_TTL_MS = 10 * 60 * 1000;
const SEED_COOLDOWN_MS = 60 * 1000;
// Short finished streams are decoys; live and master playlists have no length.
const MIN_STREAM_SECONDS = 120;

const resolveCache = createTtlCache<ResolvedStream>(RESOLVE_TTL_MS);
const seedCache = createTtlCache<string>(SEED_TTL_MS);
let seedCooldownUntil = 0;

function mix(value: number) {
  value >>>= 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function rotateLeft(value: number, shift: number) {
  value >>>= 0;
  shift &= 31;
  if (shift === 0) return value;
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function seedHash(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193) >>> 0;
  }
  return mix(hash);
}

function decodePayload(value: string) {
  const encoded = value.trim();
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) {
    throw new Error("Invalid encrypted WeCollege response.");
  }
  return Uint8Array.from(Buffer.from(encoded, "base64url"));
}

// The enc=2 answer uses the same lightweight stream cipher in the site's
// player. The marker makes a stale seed or an altered payload fail closed.
export function decryptWeCollegePayload(value: string, seed: string, mediaId: string) {
  const encrypted = decodePayload(value);
  const slots: number[] = Array(61);
  let accumulator = mix(seedHash(seed) ^ mix((Number(mediaId) >>> 0) ^ GOLDEN_RATIO));

  for (let index = 0; index < 8; index++) {
    const slot = accumulator % slots.length;
    accumulator = rotateLeft((accumulator + GOLDEN_RATIO) >>> 0, 7 + (7 & index));
    slots[slot] = (accumulator ^ mix(accumulator)) >>> 0;
    accumulator = mix((accumulator + slot) >>> 0);
  }
  accumulator = mix((0xa5a5a5a5 ^ accumulator) >>> 0);

  const decrypted = new Uint8Array(encrypted.length);
  let offset = 0;
  let counter = 0;
  while (offset < encrypted.length) {
    const slot = accumulator % slots.length;
    const slotValue = slots[slot] >>> 0;
    const definedMask = -Number(slot in slots);
    const keyed = (slotValue ^ Math.imul(GOLDEN_RATIO, counter + 1)) >>> 0;
    let word = ((accumulator ^ keyed) | (accumulator & keyed & definedMask)) >>> 0;
    word = (
      rotateLeft((word + accumulator) >>> 0, slot) ^
      rotateLeft(accumulator, Math.imul(slot, 7))
    ) >>> 0;
    accumulator = mix((word + GOLDEN_RATIO) >>> 0);
    slots[slot] = accumulator;
    counter++;

    for (let shift = 0; shift < 32 && offset < encrypted.length; shift += 8) {
      decrypted[offset] = encrypted[offset] ^ ((accumulator >>> shift) & 0xff);
      offset++;
    }
  }

  if (PAYLOAD_MARKER.some((byte, index) => decrypted[index] !== byte)) {
    throw new Error("Invalid encrypted WeCollege response.");
  }

  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      decrypted.subarray(PAYLOAD_MARKER.length),
    );
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error("Invalid encrypted WeCollege response.");
  }
}

// Quality labels name the rendition, except for the servers that answer with
// one adaptive playlist.
export function qualityHeight(quality: string) {
  const match = /^(\d{3,4})p$/i.exec(quality.trim());
  return match ? Number(match[1]) : 0;
}

// The subtitle labels carry a language code and a variant index, such as
// "English - Sdh [Eng] 3"; the player groups by language.
export function subtitleLabel(value: string) {
  return value
    .replace(/\s*\[[^\]]*\]\s*\d*$/i, "")
    .replace(/\s*-\s*Sdh\s*$/i, " SDH")
    .replace(/\s*-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function httpUrl(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function parseWeCollegeResult(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.sources)) {
    throw new Error("Invalid WeCollege response.");
  }
  const sources = body.sources.flatMap((item) => {
    if (!isRecord(item)) return [];
    const url = httpUrl(item.url);
    if (!url) return [];
    return [{ quality: typeof item.quality === "string" ? item.quality : "", url }];
  });
  const tracks = Array.isArray(body.subtitles)
    ? body.subtitles.flatMap((item) => {
        if (!isRecord(item)) return [];
        const file = httpUrl(item.url);
        if (!file) return [];
        const language = typeof item.language === "string" ? item.language : item.lang;
        const label = typeof language === "string" ? subtitleLabel(language) : undefined;
        return [{ file, label }];
      })
    : [];
  return { sources, tracks };
}

// One track per language; the first server that answers wins.
export function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    const label = track.label ?? track.file;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export async function resolveWeCollegeSeed(mediaId: string): Promise<string> {
  return seedCache.get(mediaId, async () => {
    if (Date.now() < seedCooldownUntil) throw new Error("WeCollege seed is rate limited.");
    let response: Response;
    try {
      response = await fetch(`${API}/seed?mediaId=${encodeURIComponent(mediaId)}`, {
        headers: { accept: "application/json", "user-agent": BROWSER_USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new Error("WeCollege seed failed.", { cause: error });
    }
    if (response.status === 429) {
      seedCooldownUntil = Date.now() + SEED_COOLDOWN_MS;
      await response.body?.cancel();
      throw new Error("WeCollege seed is rate limited.");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("WeCollege seed rejected the request.");
    }
    const data = (await response.json()) as { seed?: unknown };
    if (typeof data.seed !== "string" || !data.seed) throw new Error("WeCollege returned no seed.");
    return data.seed;
  });
}

function serverQuery(params: ResolveParams, seed: string) {
  const query = new URLSearchParams({
    title: params.title,
    mediaType: params.type,
    year: params.year,
    tmdbId: params.id,
    imdbId: params.imdbId,
    enc: "2",
    seed,
  });
  if (params.type === "tv") {
    query.set("seasonId", params.season);
    query.set("episodeId", params.episode);
  }
  return query;
}

async function serverPayload(server: string, params: ResolveParams, seed: string) {
  const response = await fetch(`${API}/${server}/sources?${serverQuery(params, seed)}`, {
    headers: { accept: "*/*", "user-agent": BROWSER_USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) throw new Error("WeCollege rejected the seed.");
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("WeCollege server failed.");
  }
  const payload = await response.text();
  return parseWeCollegeResult(decryptWeCollegePayload(payload, seed, params.id));
}

type Candidate = { url: string; height: number };

// A manifest is usable when it is a playlist; a master carries renditions, a
// media playlist carries segments, and a short finished one is a decoy.
async function probeManifest(url: string) {
  const text = await fetchText(url, { referer: REFERER, userAgent: BROWSER_USER_AGENT });
  if (!text.trimStart().startsWith("#EXTM3U")) return undefined;
  const master = text.includes("#EXT-X-STREAM-INF");
  const heights = [...text.matchAll(/RESOLUTION=\d+x(\d+)/g)].map((match) => Number(match[1]));
  const seconds = [...text.matchAll(/#EXTINF:([\d.]+)/g)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  if (!master && !text.includes("#EXT-X-ENDLIST") && seconds < MIN_STREAM_SECONDS) return undefined;
  return { master, height: heights.length ? Math.max(...heights) : 0 };
}

async function collectServers(params: ResolveParams, seed: string) {
  const candidates: Candidate[] = [];
  const tracks: Track[] = [];
  for (let index = 0; index < SERVERS.length; index += SERVER_BATCH_SIZE) {
    const batch = SERVERS.slice(index, index + SERVER_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((server) => serverPayload(server, params, seed)),
    );
    for (const result of results) {
      if (result.status !== "fulfilled") {
        // A rejected seed is not a server failure; the caller refreshes it.
        if (result.reason instanceof Error && result.reason.message.includes("rejected the seed")) {
          throw result.reason;
        }
        continue;
      }
      for (const source of result.value.sources) {
        candidates.push({ url: source.url, height: qualityHeight(source.quality) });
      }
      tracks.push(...result.value.tracks);
    }
    // The 4K ladder and the subtitle list are enough; the rest only add fallbacks.
    if (candidates.some((candidate) => candidate.height >= 2160) && tracks.length > 0) break;
  }
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const known = unique.get(candidate.url);
    if (!known || candidate.height > known.height) unique.set(candidate.url, candidate);
  }
  return { candidates: [...unique.values()], tracks };
}

async function resolveWithSeed(params: ResolveParams, seed: string) {
  const { candidates, tracks } = await collectServers(params, seed);
  const ordered = [...candidates].sort((a, b) => b.height - a.height);
  const variants: { file: string; height: number }[] = [];
  let chosen: Candidate | undefined;
  for (const candidate of ordered.slice(0, MAX_PROBES)) {
    if (!candidate.url.includes(".m3u8") && !candidate.url.includes("type=m3u8")) continue;
    const manifest = await probeManifest(candidate.url).catch(() => undefined);
    if (!manifest) continue;
    const height = candidate.height || manifest.height;
    if (!chosen) chosen = { url: candidate.url, height };
    if (!manifest.master && height > 0) variants.push({ file: candidate.url, height });
  }
  if (!chosen) throw new Error("WeCollege has no playable source.");
  // The player builds one variant per height, so keep the first of each.
  const renditions = new Map<number, { file: string; height: number }>();
  for (const variant of variants) {
    if (!renditions.has(variant.height)) renditions.set(variant.height, variant);
  }
  const sources = [...renditions.values()].sort((a, b) => b.height - a.height);
  return {
    url: chosen.url,
    tracks: dedupeTracks(tracks),
    ...(sources.length > 0 ? { sources } : {}),
    referer: REFERER,
    userAgent: BROWSER_USER_AGENT,
  };
}

// Test helper: drop the resolved streams and the seeds between cases.
export function clearWeCollegeCache() {
  resolveCache.clear();
  seedCache.clear();
  seedCooldownUntil = 0;
}

export function resolveWeCollegeStream(params: ResolveParams): Promise<ResolvedStream> {  const key =
    params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return resolveCache.get(key, async () => {
    const seed = await resolveWeCollegeSeed(params.id);
    try {
      return await resolveWithSeed(params, seed);
    } catch (error) {
      // A rejected seed means the cached one is stale; fetch a new one and retry.
      if (!(error instanceof Error) || !error.message.includes("rejected the seed")) throw error;
      seedCache.clear();
      const fresh = await resolveWeCollegeSeed(params.id);
      return resolveWithSeed(params, fresh);
    }
  });
}
