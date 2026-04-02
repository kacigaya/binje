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
} from "@/types/tmdb";

const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

async function tmdbFetch<T>(
  endpoint: string,
  revalidate: number = 3600
): Promise<T> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(
    `${BASE_URL}${endpoint}${separator}api_key=${API_KEY}`,
    { next: { revalidate } }
  );
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

export const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null, size = "w500") {
  if (!path) return "/no-poster.svg";
  return `${IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null, size = "original") {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function profileUrl(path: string | null, size = "w185") {
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

export async function getTrending(): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/trending/movie/week");
  return data.results;
}

export async function getPopular(): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/popular");
  return data.results;
}

export async function getTopRated(): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/top_rated");
  return data.results;
}

export async function getNowPlaying(): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/now_playing");
  return data.results;
}

export async function getUpcoming(): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>("/movie/upcoming");
  return data.results;
}

export async function getMoviesByGenre(genreId: number): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>(
    `/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`
  );
  return data.results;
}

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  return tmdbFetch<MovieDetails>(`/movie/${id}`, 86400);
}

export async function getMovieCredits(id: number): Promise<Credits> {
  return tmdbFetch<Credits>(`/movie/${id}/credits`, 86400);
}

export async function getSimilarMovies(id: number): Promise<Movie[]> {
  const data = await tmdbFetch<MovieResponse>(`/movie/${id}/similar`);
  return data.results;
}

// ─── TV Shows ──────────────────────────────────────────────

export async function getTrendingTV(): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/trending/tv/week");
  return data.results;
}

export async function getPopularTV(): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/popular");
  return data.results;
}

export async function getTopRatedTV(): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/top_rated");
  return data.results;
}

export async function getAiringTodayTV(): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/airing_today");
  return data.results;
}

export async function getOnTheAirTV(): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>("/tv/on_the_air");
  return data.results;
}

export async function getTVByGenre(genreId: number): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>(
    `/discover/tv?with_genres=${genreId}&sort_by=popularity.desc`
  );
  return data.results;
}

export async function getTVDetails(id: number): Promise<TVShowDetails> {
  return tmdbFetch<TVShowDetails>(`/tv/${id}`, 86400);
}

export async function getTVCredits(id: number): Promise<Credits> {
  return tmdbFetch<Credits>(`/tv/${id}/credits`, 86400);
}

export async function getSimilarTV(id: number): Promise<TVShow[]> {
  const data = await tmdbFetch<TVShowResponse>(`/tv/${id}/similar`);
  return data.results;
}

// ─── Search ────────────────────────────────────────────────

export async function searchMulti(query: string): Promise<MultiSearchResponse> {
  return tmdbFetch<MultiSearchResponse>(
    `/search/multi?query=${encodeURIComponent(query)}`,
    600
  );
}
