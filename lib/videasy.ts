const PLAYER_ORIGIN = "https://player.videasy.to";
const SOURCE_API = "https://api.speedracelight.com";
const DECRYPT_API = "https://enc-dec.app/api/dec-videasy";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

type Track = { file: string; label?: string };
type StreamSource = { file: string; height: number };
export type ResolverResult = { url: string; tracks: Track[]; sources?: StreamSource[] };

const BASE_HEADERS = {
  accept: "*/*",
  origin: PLAYER_ORIGIN,
  referer: `${PLAYER_ORIGIN}/`,
  "user-agent": BROWSER_USER_AGENT,
};

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

  const decryptedResponse = await fetch(DECRYPT_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: await encryptedResponse.text(),
      id: mediaId,
      seed: seedData.seed,
    }),
  });
  if (!decryptedResponse.ok) throw new Error("Videasy decrypt failed.");
  const decrypted = (await decryptedResponse.json()) as {
    status?: unknown;
    result?: unknown;
  };
  if (decrypted.status !== 200) throw new Error("Videasy decrypt failed.");
  return parseVideasyResult(decrypted.result);
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
