import type { NextRequest } from "next/server";
import { parseBrowseQuery } from "@/lib/api-validation";
import { serializeMovies, serializeTVShows } from "@/lib/mobile-api";
import { getAiringTodayTV, getNowPlaying, getOnTheAirTV, getPopular, getPopularTV, getTopRated, getTopRatedTV, getTrending, getTrendingTV, getUpcoming } from "@/lib/tmdb";
import { mobileError, mobileJson } from "../_utils";

export const browseDependencies = { getTrending, getPopular, getTopRated, getNowPlaying, getUpcoming, getTrendingTV, getPopularTV, getTopRatedTV, getAiringTodayTV, getOnTheAirTV };
export async function GET(request: NextRequest) {
  try {
    const { type, category, page, lang } = parseBrowseQuery(request.nextUrl.searchParams);
    if (type === "movie") {
      const loaders = { trending: browseDependencies.getTrending, popular: browseDependencies.getPopular, "top-rated": browseDependencies.getTopRated, "now-playing": browseDependencies.getNowPlaying, upcoming: browseDependencies.getUpcoming };
      return mobileJson({ page, items: serializeMovies(await loaders[category as keyof typeof loaders](lang)) });
    }
    const loaders = { trending: browseDependencies.getTrendingTV, popular: browseDependencies.getPopularTV, "top-rated": browseDependencies.getTopRatedTV, "airing-today": browseDependencies.getAiringTodayTV, "on-the-air": browseDependencies.getOnTheAirTV };
    return mobileJson({ page, items: serializeTVShows(await loaders[category as keyof typeof loaders](lang)) });
  } catch (error) { return mobileError(error); }
}
