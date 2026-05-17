import { NextRequest, NextResponse } from "next/server";

type StreamSource = {
  quality: string;
  url: string;
  provider?: string;
};

type Subtitle = {
  lang?: string;
  language?: string;
  url: string;
};

const VIDEASY_API_BASE = "https://api.videasy.net";
const DECODER_URL = "https://enc-dec.app/api/dec-videasy";

const PROVIDERS = [
  "cdn",
  "moviebox",
  "mb-flix",
  "1movies",
  "m4uhd",
  "superflix",
] as const;

function getYear(value: string | null) {
  if (!value) return undefined;
  const year = Number(value);
  return Number.isFinite(year) && year > 1800 ? String(Math.floor(year)) : undefined;
}

function getPositiveInt(value: string | null, fallback?: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return fallback;
}

function sortSources(sources: StreamSource[]) {
  return [...sources].sort(
    (a, b) => qualityWeight(b.quality) - qualityWeight(a.quality),
  );
}

function qualityWeight(quality: string) {
  const normalized = quality.toLowerCase();
  if (normalized.includes("4k") || normalized.includes("2160")) return 4;
  if (normalized.includes("1080")) return 3;
  if (normalized.includes("720")) return 2;
  if (normalized.includes("480")) return 1;
  return 0;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSources(value: unknown): StreamSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((source): StreamSource | null => {
      if (
        !source ||
        typeof source !== "object" ||
        !("url" in source) ||
        typeof source.url !== "string"
      ) {
        return null;
      }

      const quality =
        "quality" in source && typeof source.quality === "string"
          ? source.quality
          : "Auto";

      return { quality, url: source.url };
    })
    .filter((source): source is StreamSource => Boolean(source?.url));
}

function normalizeSubtitles(value: unknown): Subtitle[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((subtitle): Subtitle | null => {
      if (
        !subtitle ||
        typeof subtitle !== "object" ||
        !("url" in subtitle) ||
        typeof subtitle.url !== "string"
      ) {
        return null;
      }

      return {
        lang:
          "lang" in subtitle && typeof subtitle.lang === "string"
            ? subtitle.lang
            : undefined,
        language:
          "language" in subtitle && typeof subtitle.language === "string"
            ? subtitle.language
            : undefined,
        url: subtitle.url,
      };
    })
    .filter((subtitle): subtitle is Subtitle => Boolean(subtitle?.url))
    .slice(0, 25);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tmdbId = getPositiveInt(searchParams.get("tmdbId"));
  const title = searchParams.get("title")?.trim();
  const type = searchParams.get("type") === "tv" ? "tv" : "movie";

  if (!tmdbId || !title) {
    return NextResponse.json(
      { error: "Missing required player metadata." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    title,
    mediaType: type,
    tmdbId: String(tmdbId),
  });

  const imdbId = searchParams.get("imdbId");
  const year = getYear(searchParams.get("year"));
  const season = getPositiveInt(searchParams.get("season"), 1);
  const episode = getPositiveInt(searchParams.get("episode"), 1);

  if (imdbId) params.set("imdbId", imdbId);
  if (year) params.set("year", year);
  if (type === "tv") {
    params.set("seasonId", String(season));
    params.set("episodeId", String(episode));
  }

  const sourcesByUrl = new Map<string, StreamSource>();
  let subtitles: Subtitle[] = [];
  const providers: string[] = [];

  for (const provider of PROVIDERS) {
    try {
      const sourceResponse = await fetchWithTimeout(
        `${VIDEASY_API_BASE}/${provider}/sources-with-title?${params}`,
      );

      if (!sourceResponse.ok) continue;

      const encryptedText = (await sourceResponse.text()).trim();
      if (!encryptedText) continue;

      const decoderResponse = await fetchWithTimeout(DECODER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: encryptedText,
          id: String(tmdbId),
        }),
      });

      if (!decoderResponse.ok) continue;

      const decoded = await decoderResponse.json();
      const result = decoded?.result ?? decoded;
      const sources = sortSources(normalizeSources(result?.sources));

      if (sources.length === 0) continue;

      providers.push(provider);

      for (const source of sources) {
        if (!sourcesByUrl.has(source.url)) {
          sourcesByUrl.set(source.url, { ...source, provider });
        }
      }

      if (subtitles.length === 0) {
        subtitles = normalizeSubtitles(result?.subtitles);
      }
    } catch {
      continue;
    }
  }

  const sources = sortSources([...sourcesByUrl.values()]);

  if (sources.length > 0) {
    return NextResponse.json({
      provider: providers.join(","),
      sources,
      subtitles,
    });
  }

  return NextResponse.json(
    { error: "No playable stream was found." },
    { status: 404 },
  );
}
