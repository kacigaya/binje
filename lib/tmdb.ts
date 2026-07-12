import type {
  MovieResponse,
  MovieDetails,
  TVShowResponse,
  TVShowDetails,
  Credits,
  Movie,
  TVShow,
  MediaItem,
  MultiSearchResponse,
  MultiSearchResult,
  Episode,
  SeasonDetails,
  MovieImagesResponse,
  TMDBImageAsset,
  TVImagesResponse,
} from "@/types/tmdb";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;

async function tmdbFetch<T>(
  endpoint: string,
  revalidate: number = 3600,
  locale: Locale = DEFAULT_LOCALE,
): Promise<T> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(
    `${BASE_URL}${endpoint}${separator}api_key=${API_KEY}&language=${locale === "fr" ? "fr-FR" : "en-US"}`,
    { next: { revalidate } },
  );
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null, size = "w500") {
  if (!path) return "/no-poster.svg";
  return `${IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null, size = "w1280") {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function profileUrl(path: string | null, size = "w185") {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function stillUrl(path: string | null, size = "w300") {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function logoUrl(path: string | null, size = "w500") {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

// ─── Converters ────────────────────────────────────────────

export function movieToMedia(m: Movie): MediaItem {
  return {
    id: m.id,
    title: m.title,
    overview: m.overview,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    date: m.release_date,
    vote_average: m.vote_average,
    media_type: "movie",
  };
}

export function tvToMedia(t: TVShow): MediaItem {
  return {
    id: t.id,
    title: t.name,
    overview: t.overview,
    poster_path: t.poster_path,
    backdrop_path: t.backdrop_path,
    date: t.first_air_date,
    vote_average: t.vote_average,
    media_type: "tv",
  };
}

// ─── Movies ────────────────────────────────────────────────

export async function getTrending(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/trending/movie/week", 3600, locale);
  return data.results;
}

export async function getPopular(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/popular", 3600, locale);
  return data.results;
}

export async function getTopRated(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/top_rated", 3600, locale);
  return data.results;
}

export async function getNowPlaying(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/now_playing", 3600, locale);
  return data.results;
}

export async function getUpcoming(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/upcoming", 3600, locale);
  return data.results;
}

export async function getMoviesByGenre(genreId: number, locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>(
    `/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`, 3600, locale,
  );
  return data.results;
}

export async function getMovieDetails(id: number, locale: Locale = DEFAULT_LOCALE): Promise<MovieDetails> {
  return tmdbFetch<MovieDetails>(`/movie/${id}?append_to_response=release_dates`, 86400, locale);
}

function formatFrenchContentRating(rating: string | undefined): string | null {
  const value = rating?.trim();
  if (!value) return null;
  const age = value.match(/^[+-]?(\d+)$/)?.[1];
  return age ? `+${age}` : value;
}

export function getMovieContentRating(movie: MovieDetails): string | null {
  const rating = movie.release_dates.results
    .find(({ iso_3166_1 }) => iso_3166_1 === "FR")
    ?.release_dates.find(({ certification }) => certification.trim())?.certification;
  return formatFrenchContentRating(rating);
}

export async function getMovieImages(id: number, locale: Locale = DEFAULT_LOCALE): Promise<MovieImagesResponse> {
  return tmdbFetch<MovieImagesResponse>(`/movie/${id}/images?include_image_language=${locale},en,null`, 86400, locale);
}

export function pickMovieLogo(
  logos: TMDBImageAsset[],
  locale: Locale = DEFAULT_LOCALE,
): TMDBImageAsset | null {
  return (
    logos.find((logo) => logo.iso_639_1 === locale) ??
    logos.find((logo) => logo.iso_639_1 === "en") ??
    logos.find((logo) => logo.iso_639_1 === null) ??
    logos[0] ??
    null
  );
}

export async function getMovieCredits(id: number, locale: Locale = DEFAULT_LOCALE): Promise<Credits> {
  return tmdbFetch<Credits>(`/movie/${id}/credits`, 86400, locale);
}

export async function getSimilarMovies(id: number, locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>(`/movie/${id}/similar`, 3600, locale);
  return data.results;
}

// ─── TV Shows ──────────────────────────────────────────────

export async function getTrendingTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/trending/tv/week", 3600, locale);
  return data.results;
}

export async function getPopularTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/popular", 3600, locale);
  return data.results;
}

export async function getTopRatedTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/top_rated", 3600, locale);
  return data.results;
}

export async function getAiringTodayTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/airing_today", 3600, locale);
  return data.results;
}

export async function getOnTheAirTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/on_the_air", 3600, locale);
  return data.results;
}

export async function getTVByGenre(genreId: number, locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>(
    `/discover/tv?with_genres=${genreId}&sort_by=popularity.desc`, 3600, locale,
  );
  return data.results;
}

export async function getTVDetails(id: number, locale: Locale = DEFAULT_LOCALE): Promise<TVShowDetails> {
  return tmdbFetch<TVShowDetails>(
    `/tv/${id}?append_to_response=external_ids,content_ratings`,
    86400, locale,
  );
}

export function getTVContentRating(show: TVShowDetails): string | null {
  return formatFrenchContentRating(
    show.content_ratings.results.find(({ iso_3166_1 }) => iso_3166_1 === "FR")?.rating,
  );
}

export async function getTVImages(id: number, locale: Locale = DEFAULT_LOCALE): Promise<TVImagesResponse> {
  return tmdbFetch<TVImagesResponse>(`/tv/${id}/images?include_image_language=${locale},en,null`, 86400, locale);
}

export function pickTVLogo(logos: TMDBImageAsset[], locale: Locale = DEFAULT_LOCALE): TMDBImageAsset | null {
  return (
    logos.find((logo) => logo.iso_639_1 === locale) ??
    logos.find((logo) => logo.iso_639_1 === "en") ??
    logos.find((logo) => logo.iso_639_1 === null) ??
    logos[0] ??
    null
  );
}

export async function getTVCredits(id: number, locale: Locale = DEFAULT_LOCALE): Promise<Credits> {
  return tmdbFetch<Credits>(`/tv/${id}/credits`, 86400, locale);
}

export async function getSimilarTV(id: number, locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>(`/tv/${id}/similar`, 3600, locale);
  return data.results;
}

export async function getSeasonEpisodes(
  showId: number,
  seasonNumber: number,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Episode[]> {
  const data = await tmdbFetch<SeasonDetails>(
    `/tv/${showId}/season/${seasonNumber}`,
    86400, locale,
  );
  return data.episodes ?? [];
}

// ─── Search ────────────────────────────────────────────────

export async function searchMulti(
  query: string,
  page = 1,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MultiSearchResponse> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const variations = generateQueryVariations(query).slice(0, 3);
  const pagesToFetch = safePage === 1 ? [1, 2, 3] : [safePage];
  const allResults: MultiSearchResult[] = [];
  const seen = new Set<string>();
  let totalPages = 1;

  const requests = variations.flatMap((q) =>
    pagesToFetch.map((p) =>
      tmdbFetch<MultiSearchResponse>(
        `/search/multi?query=${encodeURIComponent(q)}&page=${p}`,
        600, locale,
      ),
    ),
  );

  const responses = await Promise.allSettled(requests);

  for (const response of responses) {
    if (response.status !== "fulfilled") {
      continue;
    }

    const data = response.value;
    totalPages = Math.max(totalPages, data.total_pages);

    for (const r of data.results) {
      const key = `${r.media_type}-${r.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(r);
      }
    }
  }

  const rankedResults = rankSearchResults(allResults, query);
  const normalizedQuery = normalizeForMatch(query);
  const finalResults =
    normalizedQuery.length >= 6
      ? rankedResults.filter((result) => {
          const title = (result.title ?? result.name ?? "").trim();
          if (!title) return false;
          return normalizeForMatch(title).includes(normalizedQuery);
        })
      : rankedResults;

  return {
    page: safePage,
    results: finalResults,
    total_pages: totalPages,
    total_results: finalResults.length,
  };
}

function generateQueryVariations(query: string): string[] {
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  const collapsed = normalizeForMatch(cleanQuery);
  const variations = new Set<string>();

  const addVariation = (value: string) => {
    const normalizedValue = value.trim().replace(/\s+/g, " ");
    if (normalizedValue) {
      variations.add(normalizedValue);
    }
  };

  if (!collapsed) {
    return [];
  }

  addVariation(cleanQuery);
  addVariation(collapsed);
  addVariation(cleanQuery.replace(/-/g, " "));
  addVariation(cleanQuery.replace(/\s+/g, "-"));
  addVariation(cleanQuery.replace(/[-\s]+/g, ""));

  const digitSeparated = collapsed
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2");

  if (digitSeparated !== collapsed) {
    addVariation(digitSeparated);
    addVariation(digitSeparated.replace(/\s+/g, "-"));
  }

  if (collapsed.length >= 7) {
    const broadPrefixLength = Math.max(4, Math.floor(collapsed.length * 0.7));
    const prefix = collapsed.slice(0, broadPrefixLength);
    const suffix = collapsed.slice(broadPrefixLength);

    addVariation(prefix);

    if (suffix.length >= 2) {
      addVariation(`${prefix} ${suffix}`);
      addVariation(`${prefix}-${suffix}`);
    }
  }

  return [...variations].sort();
}

function rankSearchResults(results: MultiSearchResult[], query: string) {
  const normalizedQuery = normalizeForMatch(query);

  return [...results].sort((a, b) => {
    const bScore = scoreSearchResult(b, normalizedQuery);
    const aScore = scoreSearchResult(a, normalizedQuery);
    if (bScore !== aScore) return bScore - aScore;

    const bVotes = b.vote_count ?? 0;
    const aVotes = a.vote_count ?? 0;
    if (bVotes !== aVotes) return bVotes - aVotes;

    const bRating = b.vote_average ?? 0;
    const aRating = a.vote_average ?? 0;
    if (bRating !== aRating) return bRating - aRating;

    return b.id - a.id;
  });
}

function scoreSearchResult(
  result: MultiSearchResult,
  normalizedQuery: string,
) {
  const title = (result.title ?? result.name ?? "").trim();
  if (!title) return -1000;

  const normalizedTitle = normalizeForMatch(title);
  let score = 0;
  const hasExactCanonicalMatch = normalizedTitle.includes(normalizedQuery);

  if (normalizedTitle === normalizedQuery) score += 200;
  if (normalizedTitle.startsWith(normalizedQuery)) score += 120;
  if (normalizedTitle.endsWith(normalizedQuery)) score += 100;
  if (hasExactCanonicalMatch) score += 260;
  if (!hasExactCanonicalMatch) score -= 120;
  if (result.media_type === "movie" || result.media_type === "tv") score += 20;

  score += Math.min(result.vote_count ?? 0, 2000) / 200;
  score += Math.min(result.vote_average ?? 0, 10);

  return score;
}

export function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
