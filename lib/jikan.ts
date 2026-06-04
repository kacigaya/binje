import type {
  JikanAnime,
  JikanEpisode,
  JikanItemResponse,
  JikanListResponse,
} from "@/types/anime";
import type { MediaItem } from "@/types/tmdb";

const BASE_URL = "https://api.jikan.moe/v4";

// Jikan is rate limited (~3 req/s, 60/min) and occasionally 429s under load, so
// requests are retried with backoff. Responses are cached via Next's fetch cache.
async function jikanFetch<T>(
  endpoint: string,
  revalidate: number = 3600,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        next: { revalidate },
        headers: { accept: "application/json" },
      });

      if (res.status === 429) {
        await delay(600 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      await delay(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Jikan API failed");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function animeImage(anime: JikanAnime): string | null {
  return (
    anime.images?.webp?.large_image_url ??
    anime.images?.jpg?.large_image_url ??
    anime.images?.webp?.image_url ??
    anime.images?.jpg?.image_url ??
    null
  );
}

export function animeToMedia(anime: JikanAnime): MediaItem {
  return {
    id: anime.mal_id,
    title: anime.title_english || anime.title,
    overview: anime.synopsis ?? "",
    poster_path: animeImage(anime),
    backdrop_path: null,
    date: anime.aired?.from ?? (anime.year ? `${anime.year}-01-01` : ""),
    vote_average: anime.score ?? 0,
    media_type: "anime",
  };
}

// Drops duplicate and continuation entries so carousels stay varied.
function dedupe(list: JikanAnime[]): JikanAnime[] {
  const seen = new Set<number>();
  const out: JikanAnime[] = [];
  for (const anime of list) {
    if (seen.has(anime.mal_id)) continue;
    seen.add(anime.mal_id);
    out.push(anime);
  }
  return out;
}

// ─── Browse ────────────────────────────────────────────────

export async function getTopAnime(): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    "/top/anime?filter=bypopularity&limit=24&sfw",
  );
  return dedupe(data.data);
}

export async function getAiringAnime(): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    "/top/anime?filter=airing&limit=24&sfw",
  );
  return dedupe(data.data);
}

export async function getUpcomingAnime(): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    "/top/anime?filter=upcoming&limit=24&sfw",
  );
  return dedupe(data.data);
}

export async function getSeasonalAnime(): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    "/seasons/now?limit=24&sfw",
  );
  return dedupe(data.data);
}

export async function getAnimeByGenre(genreId: number): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    `/anime?genres=${genreId}&order_by=members&sort=desc&limit=24&sfw`,
  );
  return dedupe(data.data);
}

// ─── Detail ────────────────────────────────────────────────

export async function getAnimeDetails(id: number): Promise<JikanAnime> {
  const data = await jikanFetch<JikanItemResponse<JikanAnime>>(
    `/anime/${id}/full`,
    86400,
  );
  return data.data;
}

export async function getAnimeEpisodes(
  id: number,
  page = 1,
): Promise<{ episodes: JikanEpisode[]; hasNextPage: boolean }> {
  const data = await jikanFetch<JikanListResponse<JikanEpisode>>(
    `/anime/${id}/episodes?page=${page}`,
    86400,
  );
  return {
    episodes: data.data ?? [],
    hasNextPage: data.pagination?.has_next_page ?? false,
  };
}

export async function getAnimeRecommendations(
  id: number,
): Promise<JikanAnime[]> {
  try {
    const data = await jikanFetch<
      JikanListResponse<{ entry: JikanAnime }>
    >(`/anime/${id}/recommendations`, 86400);
    return dedupe(data.data.map((item) => item.entry)).slice(0, 18);
  } catch {
    return [];
  }
}

// ─── Search ────────────────────────────────────────────────

export async function searchAnime(query: string): Promise<JikanAnime[]> {
  const data = await jikanFetch<JikanListResponse<JikanAnime>>(
    `/anime?q=${encodeURIComponent(query)}&order_by=members&sort=desc&limit=24&sfw`,
    600,
  );
  return dedupe(data.data);
}

// Anime genre ids on MyAnimeList.
export const ANIME_GENRES = {
  action: 1,
  adventure: 2,
  comedy: 4,
  drama: 8,
  fantasy: 10,
  romance: 22,
  sciFi: 24,
  sliceOfLife: 36,
  supernatural: 37,
  sports: 30,
} as const;
