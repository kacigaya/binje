import type { ResolveParams } from "@/lib/resolve-cache";
import { fetchText, isRecord, UpstreamError } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// Wyzie Subs finds subtitles by title for sources that ship none. The key is
// billed per search and per download (1,000 a day on a free key), and the
// download links carry a token billed to it, so both stay on the server:
// searches and files are cached here and players get same-origin URLs.
const API = "https://sub.wyzie.io";
const LANGUAGES = ["fr", "en"] as const;
const FORMATS = new Set(["srt", "vtt"]);
const searchCache = createTtlCache<WyzieSubtitle[]>(12 * 60 * 60 * 1000);
const fileCache = createTtlCache<string>(24 * 60 * 60 * 1000, 200);

// Upstream requests allowed per UTC day: WYZIE_DAILY_REQUESTS, else 900,
// under a free key's 1,000. The per-IP
// limit on /api/subtitles slows one caller; this caps everyone together.
// ponytail: per process and reset on restart, like lib/rate-limit.ts. That
// holds for this single-container deployment; a free key is also capped by
// Wyzie itself. Several instances on a paid key would need a shared counter.
let spent = { day: "", count: 0 };

export class WyzieBudgetError extends Error {
  constructor() {
    super("Daily Wyzie budget spent.");
    this.name = "WyzieBudgetError";
  }
}

function spend() {
  const day = new Date().toISOString().slice(0, 10);
  if (spent.day !== day) spent = { day, count: 0 };
  if (spent.count >= (Number(process.env.WYZIE_DAILY_REQUESTS) || 900)) throw new WyzieBudgetError();
  spent.count++;
}

export type WyzieSubtitle = { id: string; url: string; language: string; hearingImpaired: boolean };

function apiKey() {
  return process.env.WYZIE_API_KEY?.trim() || null;
}

export function subtitlesEnabled() {
  return apiKey() !== null;
}

// One subtitle per language, in LANGUAGES order: the first listed file that is
// not AI-translated, preferring one without hearing-impaired cues.
export function pickSubtitles(body: unknown): WyzieSubtitle[] {
  if (!Array.isArray(body)) return [];
  const usable = body.flatMap((entry): WyzieSubtitle[] => {
    if (!isRecord(entry) || entry.ai === true) return [];
    const { id, url, language, format } = entry;
    if (typeof id !== "string" && typeof id !== "number") return [];
    if (typeof url !== "string" || !url.startsWith(`${API}/`)) return [];
    if (typeof language !== "string" || typeof format !== "string" || !FORMATS.has(format)) return [];
    return [{ id: String(id), url, language, hearingImpaired: entry.isHearingImpaired === true }];
  });
  return LANGUAGES.flatMap((language) => {
    const matches = usable.filter((item) => item.language === language);
    const pick = matches.find((item) => !item.hearingImpaired) ?? matches[0];
    return pick ? [pick] : [];
  });
}

export function searchSubtitles(params: ResolveParams): Promise<WyzieSubtitle[]> {
  const key = apiKey();
  if (!key) return Promise.resolve([]);
  // An IMDb id names one title; TMDB reuses ids across movies and shows.
  const id = params.imdbId || params.id;
  const cacheKey = params.type === "tv" ? `tv:${id}:${params.season}:${params.episode}` : `movie:${id}`;
  return searchCache.get(cacheKey, async () => {
    const query = new URLSearchParams({ id, language: LANGUAGES.join(","), format: [...FORMATS].join(",") });
    if (params.type === "tv") {
      query.set("season", params.season);
      query.set("episode", params.episode);
    }
    query.set("key", key);
    spend();
    try {
      return pickSubtitles(JSON.parse(await fetchText(`${API}/search?${query}`)));
    } catch (error) {
      // Wyzie answers 400 when nothing matches; that result is worth caching.
      if (error instanceof UpstreamError && error.status === 400) return [];
      throw error;
    }
  });
}

// The file as WebVTT, which <track> and Cast both read.
export function subtitleFile(subtitle: WyzieSubtitle): Promise<string> {
  return fileCache.get(subtitle.id, async () => {
    const url = new URL(subtitle.url);
    url.searchParams.set("to", "vtt");
    spend();
    const text = await fetchText(url.href);
    if (!text.trimStart().startsWith("WEBVTT")) throw new Error("Not a WebVTT file.");
    return text;
  });
}
