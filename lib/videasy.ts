const PLAYER_ORIGIN = "https://player.videasy.to";
const SOURCE_API = "https://api.speedracelight.com";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const GOLDEN_RATIO = 0x9e3779b9;
const PAYLOAD_MARKER = new Uint8Array([0x6d, 0x76, 0x6d, 0x31]);

type Track = { file: string; label?: string };
type StreamSource = { file: string; height: number };
export type ResolverResult = { url: string; tracks: Track[]; sources?: StreamSource[] };

const BASE_HEADERS = {
  accept: "*/*",
  origin: PLAYER_ORIGIN,
  referer: `${PLAYER_ORIGIN}/`,
  "user-agent": BROWSER_USER_AGENT,
};

function mix(value: number) {
  value >>>= 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function rotateLeft(value: number, shift: number) {
  value >>>= 0;
  shift &= 31;
  return shift === 0 ? value : ((value << shift) | (value >>> (32 - shift))) >>> 0;
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
    throw new Error("Invalid encrypted Videasy response.");
  }
  return Uint8Array.from(Buffer.from(encoded, "base64url"));
}

// Videasy's enc=2 response uses the same lightweight stream cipher in its web
// player. The marker makes a stale seed or altered payload fail closed.
function decryptVideasyPayload(value: string, seed: string, mediaId: string) {
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
    throw new Error("Invalid encrypted Videasy response.");
  }

  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      decrypted.subarray(PAYLOAD_MARKER.length),
    );
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error("Invalid encrypted Videasy response.");
  }
}

function qualityHeight(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.toUpperCase() === "4K") return 2160;
  const height = Number(value.match(/^(\d+)p$/i)?.[1]);
  return Number.isInteger(height) && height > 0 ? height : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseVideasyResult(value: unknown): ResolverResult {
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    throw new Error("Invalid Videasy response.");
  }

  const adaptiveSource = value.sources.find(
    (item) => isRecord(item) && item.type === "hls" && typeof item.url === "string",
  ) as Record<string, unknown> | undefined;
  const sources = value.sources
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.url !== "string") return [];
      const height = qualityHeight(item.quality);
      return height ? [{ file: item.url, height }] : [];
    })
    .sort((a, b) => b.height - a.height);
  const defaultSource = sources.find(({ height }) => height === 1080) ?? sources[0];
  if (!adaptiveSource && !defaultSource) throw new Error("No playable HLS source.");

  const labels = new Set<string>();
  const tracks = Array.isArray(value.subtitles)
    ? value.subtitles.flatMap((item) => {
        if (!isRecord(item) || typeof item.url !== "string") return [];
        const label =
          typeof item.language === "string"
            ? item.language
            : typeof item.lang === "string"
              ? item.lang
              : undefined;
        if (label && labels.has(label)) return [];
        if (label) labels.add(label);
        return [{ file: item.url, label }];
      })
    : [];

  return {
    url: defaultSource?.file ?? (adaptiveSource!.url as string),
    tracks,
    ...(sources.length > 0 ? { sources } : {}),
  };
}

async function resolveServer(
  server: "cdn" | "vsrc",
  parameters: URLSearchParams,
  mediaId: string,
) {
  const seedResponse = await fetch(`${SOURCE_API}/seed?mediaId=${mediaId}`, {
    headers: BASE_HEADERS,
  });
  if (!seedResponse.ok) throw new Error("Videasy seed failed.");
  const seedData = (await seedResponse.json()) as { seed?: unknown };
  if (typeof seedData.seed !== "string") throw new Error("No Videasy seed.");

  parameters.set("seed", seedData.seed);
  const encryptedResponse = await fetch(
    `${SOURCE_API}/${server}/sources-with-title?${parameters}`,
    { headers: BASE_HEADERS },
  );
  if (!encryptedResponse.ok) throw new Error("Videasy source failed.");

  return parseVideasyResult(
    decryptVideasyPayload(await encryptedResponse.text(), seedData.seed, mediaId),
  );
}

export async function resolveVideasyStream({
  type,
  id,
  title,
  year,
  imdbId,
  season,
  episode,
}: {
  type: "movie" | "tv";
  id: string;
  title: string;
  year: string;
  imdbId: string;
  season: string;
  episode: string;
}) {
  const parameters = new URLSearchParams({
    title: encodeURIComponent(title),
    mediaType: type,
    year,
    tmdbId: id,
    imdbId,
    enc: "2",
  });
  if (type === "tv") {
    parameters.set("seasonId", season);
    parameters.set("episodeId", episode);
  }

  const highQuality = await resolveServer("cdn", parameters, id).catch(() =>
    resolveServer("cdn", parameters, id).catch(() => null),
  );
  if (highQuality?.sources?.some(({ height }) => height >= 1080)) return highQuality;
  return resolveServer("vsrc", parameters, id);
}
