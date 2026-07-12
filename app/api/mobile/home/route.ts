import type { NextRequest } from "next/server";
import { parseLocale } from "@/lib/api-validation";
import { serializeMovies, serializeTVShows } from "@/lib/mobile-api";
import { getTrending, getTrendingTV } from "@/lib/tmdb";
import { mobileError, mobileJson } from "../_utils";

export const homeDependencies = { getTrending, getTrendingTV };
export async function GET(request: NextRequest) {
  try {
    const lang = parseLocale(request.nextUrl.searchParams.get("lang"));
    const [movies, shows] = await Promise.all([homeDependencies.getTrending(lang), homeDependencies.getTrendingTV(lang)]);
    const trendingMovies = serializeMovies(movies);
    const trendingTV = serializeTVShows(shows);
    const featured = [...trendingMovies.slice(0, 3), ...trendingTV.slice(0, 2)];
    return mobileJson({ featured, trendingMovies, trendingTV });
  } catch (error) { return mobileError(error); }
}
