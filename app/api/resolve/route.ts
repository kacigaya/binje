import { NextRequest, NextResponse } from "next/server";

// ponytail: stream extraction depends on Videasy and enc-dec.app (third-party,
// closed-source, 40 req/s). If either changes, update this resolver and Worker.
const PLAYER_ORIGIN = "https://player.videasy.to";
const SOURCE_API = "https://api.wingsdatabase.com";
const ENC_API = "https://enc-dec.app/api";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export const runtime = "nodejs";
export const maxDuration = 20;

const BASE_HEADERS = {
  accept: "*/*",
  origin: PLAYER_ORIGIN,
  referer: `${PLAYER_ORIGIN}/`,
  "user-agent": BROWSER_USER_AGENT,
};

type Track = { file: string; label?: string };
type StreamSource = { file: string; height: number };
type ResolverResult = { url: string; tracks: Track[]; sources?: StreamSource[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function qualityHeight(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.toUpperCase() === "4K") return 2160;
  const height = Number(value.match(/^(\d+)p$/i)?.[1]);
  return Number.isInteger(height) && height > 0 ? height : null;
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
  server: "cdn" | "neon2",
  parameters: URLSearchParams,
  id: string,
  seed: string,
) {
  const encrypted = await fetch(
    `${SOURCE_API}/${server}/sources-with-title?${parameters.toString()}`,
    { headers: BASE_HEADERS, cache: "no-store" },
  ).then((response) => response.text());

  const decrypted = await fetch(`${ENC_API}/dec-videasy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: encrypted, id, seed }),
    cache: "no-store",
  }).then((response) => response.json());
  if (decrypted.status !== 200) throw new Error("dec-videasy failed.");

  return parseVideasyResult(decrypted.result);
}

async function extract({
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
  const seedResponse = await fetch(`${SOURCE_API}/seed?mediaId=${id}`, {
    headers: BASE_HEADERS,
    cache: "no-store",
  }).then((response) => response.json());
  const seed = seedResponse.seed as string | undefined;
  if (!seed) throw new Error("No Videasy seed.");

  const parameters = new URLSearchParams({
    title: encodeURIComponent(title),
    mediaType: type,
    year,
    tmdbId: id,
    imdbId,
    enc: "2",
    seed,
  });
  if (type === "tv") {
    parameters.set("seasonId", season);
    parameters.set("episodeId", episode);
  }

  const highQuality = await resolveServer("cdn", parameters, id, seed).catch(() =>
    resolveServer("cdn", parameters, id, seed).catch(() => null),
  );
  if (highQuality?.sources?.some(({ height }) => height >= 1080)) return highQuality;

  return resolveServer("neon2", parameters, id, seed);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = query.get("type");
  const id = query.get("id");
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  const validEpisode =
    type !== "tv" || (/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode));

  if (
    (type !== "movie" && type !== "tv") ||
    !/^\d+$/.test(id ?? "") ||
    !title ||
    title.length > 200 ||
    !/^\d{4}$/.test(year) ||
    (imdbId !== "" && !/^tt\d+$/.test(imdbId)) ||
    !validEpisode
  ) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const result = await extract({
      type,
      id: id!,
      title,
      year,
      imdbId,
      season,
      episode,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve stream." },
      { status: 502 },
    );
  }
}
