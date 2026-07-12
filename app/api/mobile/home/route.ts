import type { NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n";
import type { MobileFeaturedItem, MobileMediaSummary } from "@/types/mobile-api";
import { parseLocale } from "@/lib/api-validation";
import { serializeMovies, serializeTVShows } from "@/lib/mobile-api";
import {
  getMovieContentRating,
  getMovieDetails,
  getMovieImages,
  getTrending,
  getTrendingTV,
  getTVContentRating,
  getTVDetails,
  getTVImages,
  logoUrl,
  pickMovieLogo,
  pickTVLogo,
} from "@/lib/tmdb";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";
import { mobileError, mobileJson } from "../_utils";

export const homeDependencies = {
  getTrending,
  getTrendingTV,
  getMovieDetails,
  getMovieImages,
  getTVDetails,
  getTVImages,
  getRottenTomatoesScore,
};

async function enrichFeatured(summary: MobileMediaSummary, lang: Locale): Promise<MobileFeaturedItem> {
  const isMovie = summary.mediaType === "movie";
  const [images, details] = await Promise.all([
    (isMovie ? homeDependencies.getMovieImages(summary.id, lang) : homeDependencies.getTVImages(summary.id, lang)).catch(() => null),
    (isMovie ? homeDependencies.getMovieDetails(summary.id, lang) : homeDependencies.getTVDetails(summary.id, lang)).catch(() => null),
  ]);
  const logo = images ? (isMovie ? pickMovieLogo(images.logos, lang) : pickTVLogo(images.logos, lang)) : null;
  const imdbId = details ? (isMovie ? (details as { imdb_id?: string | null }).imdb_id : (details as { external_ids?: { imdb_id?: string | null } }).external_ids?.imdb_id) : null;
  const rottenTomatoesScore = await homeDependencies.getRottenTomatoesScore(imdbId).catch(() => null);
  const contentRating = details
    ? isMovie
      ? getMovieContentRating(details as Parameters<typeof getMovieContentRating>[0])
      : getTVContentRating(details as Parameters<typeof getTVContentRating>[0])
    : null;
  return { ...summary, logoUrl: logo ? logoUrl(logo.file_path) : null, rottenTomatoesScore, contentRating };
}

export async function GET(request: NextRequest) {
  try {
    const lang = parseLocale(request.nextUrl.searchParams.get("lang"));
    const [movies, shows] = await Promise.all([homeDependencies.getTrending(lang), homeDependencies.getTrendingTV(lang)]);
    const trendingMovies = serializeMovies(movies);
    const trendingTV = serializeTVShows(shows);
    const featured = await Promise.all(
      [...trendingMovies.slice(0, 3), ...trendingTV.slice(0, 2)].map((item) => enrichFeatured(item, lang)),
    );
    return mobileJson({ featured, trendingMovies, trendingTV });
  } catch (error) { return mobileError(error); }
}
