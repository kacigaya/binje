import type {
  MovieDetails,
  TVShowDetails,
  Credits,
  Movie,
  TVShow,
  MediaItem,
  MultiSearchResponse,
  MultiSearchResult,
  Episode,
  Genre,
  SeasonDetails,
  MovieImagesResponse,
  TMDBImageAsset,
  TVImagesResponse,
} from "@/types/tmdb";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;

// Caching is owned by `"use cache"` in `@/lib/cached-tmdb`; the numeric
// second argument only stays for existing callers.
async function tmdbFetch<T>(
  endpoint: string,
  _revalidate: number = 3600,
  locale: Locale = DEFAULT_LOCALE,
): Promise<T> {
  void _revalidate;
  const separator = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(
    `${BASE_URL}${endpoint}${separator}api_key=${API_KEY}&language=${locale === "fr" ? "fr-FR" : "en-US"}`,
  );
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

async function fetchList<T>(
  endpoint: string,
  locale: Locale,
  revalidate = 3600,
): Promise<T[]> {
  const data = await tmdbFetch<{ results: T[] }>(endpoint, revalidate, locale);
  return data.results;
}

/** Strict TMDB id parse for route params. Returns null for anything that is not a positive integer. */
export function parseTmdbId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
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

export function getTrending(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>("/trending/movie/week", locale);
}

export function getPopular(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>("/movie/popular", locale);
}

export function getTopRated(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>("/movie/top_rated", locale);
}

export function getNowPlaying(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>("/movie/now_playing", locale);
}

export function getUpcoming(locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>("/movie/upcoming", locale);
}

export function getMoviesByGenre(genreId: number, locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>(
    `/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`, locale,
  );
}

export async function getGenres(
  type: "movie" | "tv",
  locale: Locale = DEFAULT_LOCALE,
): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>(`/genre/${type}/list`, 86400, locale);
  return data.genres;
}

/** One page of `/discover`; `endpoint` comes from `discoverEndpoint`. */
export async function discover<T extends Movie | TVShow>(
  endpoint: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ results: T[]; totalPages: number }> {
  const data = await tmdbFetch<{ results: T[]; total_pages: number }>(endpoint, 3600, locale);
  return { results: data.results, totalPages: data.total_pages };
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

/** Skip SVG logos: the Next image optimizer and React Native Image cannot render them. */
export function pickLogo(
  allLogos: TMDBImageAsset[],
  locale: Locale = DEFAULT_LOCALE,
): TMDBImageAsset | null {
  const logos = allLogos.filter(
    (logo) => !logo.file_path.toLowerCase().endsWith(".svg"),
  );
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

export function getSimilarMovies(id: number, locale: Locale = DEFAULT_LOCALE): Promise<Movie[]> {
  return fetchList<Movie>(`/movie/${id}/similar`, locale);
}

export function getTrendingTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>("/trending/tv/week", locale);
}

export function getPopularTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>("/tv/popular", locale);
}

export function getTopRatedTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>("/tv/top_rated", locale);
}

export function getAiringTodayTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>("/tv/airing_today", locale);
}

export function getOnTheAirTV(locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>("/tv/on_the_air", locale);
}

export function getTVByGenre(genreId: number, locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>(
    `/discover/tv?with_genres=${genreId}&sort_by=popularity.desc`, locale,
  );
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

export async function getTVCredits(id: number, locale: Locale = DEFAULT_LOCALE): Promise<Credits> {
  return tmdbFetch<Credits>(`/tv/${id}/credits`, 86400, locale);
}

export function getSimilarTV(id: number, locale: Locale = DEFAULT_LOCALE): Promise<TVShow[]> {
  return fetchList<TVShow>(`/tv/${id}/similar`, locale);
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

export async function searchMulti(
  query: string,
  page = 1,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MultiSearchResponse> {
  return searchLocalized(query, page, locale, false);
}

/** Typeahead uses the same title index, but only fetches the first page. */
export async function searchSuggestions(
  query: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MultiSearchResponse> {
  const data = await searchLocalized(query, 1, locale, true);
  const results = data.results.filter((result) =>
    result.media_type === "movie" || result.media_type === "tv",
  );
  return { ...data, results, total_results: results.length };
}

async function searchLocalized(
  query: string,
  page: number,
  locale: Locale,
  suggestionsOnly: boolean,
): Promise<MultiSearchResponse> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const variations = generateQueryVariations(query);
  if (variations.length === 0) {
    return { page: safePage, results: [], total_pages: 0, total_results: 0 };
  }

  const pages = !suggestionsOnly && safePage === 1 ? [1, 2, 3] : [safePage];
  // TMDB searches translated and alternative titles. `language` controls display.
  // Do not filter by the returned title: the matching alias may be absent from it.
  const displayRequests = variations.flatMap((variation) =>
    pages.map((p) => tmdbFetch<MultiSearchResponse>(
      `/search/multi?query=${encodeURIComponent(variation)}&page=${p}`,
      600, locale,
    )),
  );
  // Rank translated matches by ID. Never use these responses for display.
  const otherLocale = locale === "fr" ? "en" : "fr";
  const titleRequests = pages.map((p) => tmdbFetch<MultiSearchResponse>(
    `/search/multi?query=${encodeURIComponent(variations[0])}&page=${p}`,
    600, otherLocale,
  ));
  const responses = await Promise.allSettled([...displayRequests, ...titleRequests]);
  const titlesById = new Map<string, string[]>();
  for (const response of responses.slice(displayRequests.length)) {
    if (response.status !== "fulfilled") continue;
    for (const result of response.value.results) {
      titlesById.set(`${result.media_type}-${result.id}`, [result.title ?? result.name ?? ""]);
    }
  }
  const results = new Map<string, MultiSearchResult>();
  let totalPages = 0;
  let succeeded = false;
  for (const response of responses.slice(0, displayRequests.length)) {
    if (response.status !== "fulfilled") continue;
    succeeded = true;
    totalPages = Math.max(totalPages, response.value.total_pages);
    for (const result of response.value.results) {
      const key = `${result.media_type}-${result.id}`;
      if (!results.has(key)) results.set(key, result);
    }
  }
  if (!succeeded) throw new Error("TMDB search failed");

  const ranked = rankSearchResults([...results.values()], query, titlesById);
  return {
    page: safePage,
    results: ranked,
    total_pages: totalPages,
    total_results: ranked.length,
  };
}

function generateQueryVariations(query: string): string[] {
  const cleanQuery = query.trim().replace(/\s+/g, " ");
  const normalized = normalizeSearchText(cleanQuery);
  if (!normalized) return [];

  // Keep the full title first. Prefix searches can return unrelated movies.
  return [...new Set([cleanQuery, normalized, normalizeForMatch(cleanQuery)])];
}

function rankSearchResults(
  results: MultiSearchResult[],
  query: string,
  titlesById: Map<string, string[]>,
) {
  const normalizedQuery = normalizeForMatch(query);

  return [...results].sort((a, b) => {
    const bScore = scoreSearchResult(b, normalizedQuery, titlesById.get(`${b.media_type}-${b.id}`));
    const aScore = scoreSearchResult(a, normalizedQuery, titlesById.get(`${a.media_type}-${a.id}`));
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
  translatedTitles: string[] = [],
) {
  const titles = [
    result.title, result.name, result.original_title, result.original_name,
    ...translatedTitles,
    ...(result.alternative_titles ?? []), ...(result.matched_titles ?? []),
  ].filter((title): title is string => Boolean(title?.trim()));
  if (titles.length === 0) return -1000;

  let score = Math.max(...titles.map((title) => {
    const normalizedTitle = normalizeForMatch(title);
    let titleScore = 0;
    if (normalizedTitle === normalizedQuery) titleScore += 200;
    if (normalizedTitle.startsWith(normalizedQuery)) titleScore += 120;
    if (normalizedTitle.endsWith(normalizedQuery)) titleScore += 100;
    if (normalizedTitle.includes(normalizedQuery)) titleScore += 260;
    return titleScore;
  }));

  if (result.media_type === "movie" || result.media_type === "tv") score += 20;

  score += Math.min(result.vote_count ?? 0, 2000) / 200;
  score += Math.min(result.vote_average ?? 0, 10);

  return score;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeForMatch(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}
