import "server-only";

import { cacheLife } from "next/cache";
import type { Locale } from "@/lib/i18n";
import type {
  Credits,
  Episode,
  Movie,
  MovieDetails,
  MovieImagesResponse,
  TVImagesResponse,
  TVShow,
  TVShowDetails,
} from "@/types/tmdb";
import {
  getAiringTodayTV as fetchAiringTodayTV,
  getMovieCredits as fetchMovieCredits,
  getMovieDetails as fetchMovieDetails,
  getMovieImages as fetchMovieImages,
  getMoviesByGenre as fetchMoviesByGenre,
  getNowPlaying as fetchNowPlaying,
  getOnTheAirTV as fetchOnTheAirTV,
  getPopular as fetchPopular,
  getPopularTV as fetchPopularTV,
  getSeasonEpisodes as fetchSeasonEpisodes,
  getSimilarMovies as fetchSimilarMovies,
  getSimilarTV as fetchSimilarTV,
  getTopRated as fetchTopRated,
  getTopRatedTV as fetchTopRatedTV,
  getTrending as fetchTrending,
  getTrendingTV as fetchTrendingTV,
  getTVCredits as fetchTVCredits,
  getTVByGenre as fetchTVByGenre,
  getTVDetails as fetchTVDetails,
  getTVImages as fetchTVImages,
  getUpcoming as fetchUpcoming,
} from "@/lib/tmdb";

export async function getTrending(locale: Locale): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchTrending(locale);
}

export async function getPopular(locale: Locale): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchPopular(locale);
}

export async function getTopRated(locale: Locale): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchTopRated(locale);
}

export async function getNowPlaying(locale: Locale): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchNowPlaying(locale);
}

export async function getUpcoming(locale: Locale): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchUpcoming(locale);
}

export async function getMoviesByGenre(
  genreId: number,
  locale: Locale,
): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchMoviesByGenre(genreId, locale);
}

export async function getMovieDetails(
  id: number,
  locale: Locale,
): Promise<MovieDetails> {
  "use cache";
  cacheLife("days");
  return fetchMovieDetails(id, locale);
}

export async function getMovieImages(
  id: number,
  locale: Locale,
): Promise<MovieImagesResponse> {
  "use cache";
  cacheLife("days");
  return fetchMovieImages(id, locale);
}

export async function getMovieCredits(
  id: number,
  locale: Locale,
): Promise<Credits> {
  "use cache";
  cacheLife("days");
  return fetchMovieCredits(id, locale);
}

export async function getSimilarMovies(
  id: number,
  locale: Locale,
): Promise<Movie[]> {
  "use cache";
  cacheLife("hours");
  return fetchSimilarMovies(id, locale);
}

export async function getTrendingTV(locale: Locale): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchTrendingTV(locale);
}

export async function getPopularTV(locale: Locale): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchPopularTV(locale);
}

export async function getTopRatedTV(locale: Locale): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchTopRatedTV(locale);
}

export async function getAiringTodayTV(locale: Locale): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchAiringTodayTV(locale);
}

export async function getOnTheAirTV(locale: Locale): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchOnTheAirTV(locale);
}

export async function getTVByGenre(
  genreId: number,
  locale: Locale,
): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchTVByGenre(genreId, locale);
}

export async function getTVDetails(
  id: number,
  locale: Locale,
): Promise<TVShowDetails> {
  "use cache";
  cacheLife("days");
  return fetchTVDetails(id, locale);
}

export async function getTVImages(
  id: number,
  locale: Locale,
): Promise<TVImagesResponse> {
  "use cache";
  cacheLife("days");
  return fetchTVImages(id, locale);
}

export async function getTVCredits(
  id: number,
  locale: Locale,
): Promise<Credits> {
  "use cache";
  cacheLife("days");
  return fetchTVCredits(id, locale);
}

export async function getSimilarTV(
  id: number,
  locale: Locale,
): Promise<TVShow[]> {
  "use cache";
  cacheLife("hours");
  return fetchSimilarTV(id, locale);
}

export async function getSeasonEpisodes(
  showId: number,
  seasonNumber: number,
  locale: Locale,
): Promise<Episode[]> {
  "use cache";
  cacheLife("days");
  return fetchSeasonEpisodes(showId, seasonNumber, locale);
}
