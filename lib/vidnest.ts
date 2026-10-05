import type { ResolveParams } from "@/lib/resolve-cache";
import { firstInOrder, fetchJson, httpUrl, isPlayableManifest, isRecord, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

const API = "https://new.vidnest.fun";
const PLAYER = "https://vidnest.fun/";
// Vidnest encodes responses as base64 over a shuffled alphabet.
const ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/";
const STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
// Backends from Vidnest's own player, most reliable first in live checks. Its
// vidzee and vidlink backends duplicate sources b!nje resolves directly.
const BACKENDS = ["yflix", "rpmvid", "rogflix", "nextgencloudfabric", "superstream", "videasy", "klikxxi"];
const LANGUAGES = /^(?:english|original|multi)$/i;
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

type Candidate = { url: string; referer?: string; userAgent?: string };

export function decodeVidnest(data: string): string {
  const standard = Array.from(data, (char) => {
    const index = ALPHABET.indexOf(char);
    return index < 0 ? char : STANDARD[index];
  }).join("");
  return Buffer.from(standard, "base64").toString("utf8");
}

function header(headers: unknown, name: string) {
  if (!isRecord(headers)) return;
  const value = headers[name];
  return typeof value === "string" && value ? value : undefined;
}

// Backends answer in four shapes: a bare { url, headers }, { streams },
// { sources } and { all_urls }. Only HLS in an understood language is kept.
export function vidnestCandidates(body: unknown): Candidate[] {
  if (!isRecord(body)) return [];
  const entries: unknown[] = [];
  if (typeof body.url === "string") entries.push(body);
  for (const list of [body.streams, body.sources]) if (Array.isArray(list)) entries.push(...list);
  if (Array.isArray(body.all_urls)) entries.push(...body.all_urls.map((url) => ({ url })));
  return entries.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (entry.type !== undefined && entry.type !== "hls") return [];
    if (typeof entry.language === "string" && !LANGUAGES.test(entry.language)) return [];
    const url = httpUrl(entry.url);
    if (!url) return [];
    // Vidnest's player requests these from its own page when no Referer is given.
    const referer = httpUrl(header(entry.headers, "Referer") ?? header(body.headers, "Referer")) ?? PLAYER;
    const userAgent = header(entry.headers, "User-Agent") ?? header(body.headers, "User-Agent");
    return [{ url, referer, userAgent }];
  });
}

async function backend(name: string, { type, id, season, episode }: ResolveParams): Promise<Candidate> {
  const path = type === "tv" ? `${name}/tv/${id}/${season}/${episode}` : `${name}/movie/${id}`;
  const body = await fetchJson(`${API}/${path}`, { referer: PLAYER });
  const decoded = isRecord(body) && body.encrypted === true && typeof body.data === "string"
    ? JSON.parse(decodeVidnest(body.data))
    : body;
  return firstInOrder(
    vidnestCandidates(decoded).map(async (candidate) => {
      if (!(await isPlayableManifest(candidate.url, candidate))) throw new Error("Unplayable stream.");
      return candidate;
    }),
  );
}

export function resolveVidnestStream(params: ResolveParams): Promise<ResolvedStream> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return cache.get(key, async () => {
    const stream = await firstInOrder(BACKENDS.map((name) => backend(name, params)));
    return { url: stream.url, tracks: [], referer: stream.referer, userAgent: stream.userAgent };
  });
}
