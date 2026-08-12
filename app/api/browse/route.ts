import { NextRequest, NextResponse } from "next/server";
import { localeOrDefault, type Locale } from "@/lib/i18n";
import {
  getAiringTodayTV,
  getMoviesByGenre,
  getNowPlaying,
  getOnTheAirTV,
  getPopular,
  getPopularTV,
  getTopRated,
  getTopRatedTV,
  getTVByGenre,
  getUpcoming,
  movieToMedia,
  tvToMedia,
} from "@/lib/tmdb";

const MOVIE_LOADERS: Record<string, (locale: Locale) => ReturnType<typeof getPopular>> = {
  popular: getPopular,
  "top-rated": getTopRated,
  "now-playing": getNowPlaying,
  upcoming: getUpcoming,
  "genre-28": (locale) => getMoviesByGenre(28, locale),
  "genre-35": (locale) => getMoviesByGenre(35, locale),
  "genre-18": (locale) => getMoviesByGenre(18, locale),
  "genre-27": (locale) => getMoviesByGenre(27, locale),
  "genre-878": (locale) => getMoviesByGenre(878, locale),
};

const TV_LOADERS: Record<string, (locale: Locale) => ReturnType<typeof getPopularTV>> = {
  popular: getPopularTV,
  "top-rated": getTopRatedTV,
  "airing-today": getAiringTodayTV,
  "on-the-air": getOnTheAirTV,
  "genre-10759": (locale) => getTVByGenre(10759, locale),
  "genre-35": (locale) => getTVByGenre(35, locale),
  "genre-18": (locale) => getTVByGenre(18, locale),
  "genre-10765": (locale) => getTVByGenre(10765, locale),
  "genre-99": (locale) => getTVByGenre(99, locale),
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const locale = localeOrDefault(request.nextUrl.searchParams.get("lang"));
  const loader = type === "movie" ? MOVIE_LOADERS[category] : type === "tv" ? TV_LOADERS[category] : undefined;
  if (!loader) return NextResponse.json({ error: "Invalid browse category" }, { status: 400 });

  try {
    const results = await loader(locale);
    const items = type === "movie"
      ? results.map((item) => movieToMedia(item as Parameters<typeof movieToMedia>[0]))
      : results.map((item) => tvToMedia(item as Parameters<typeof tvToMedia>[0]));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Browse request failed" }, { status: 502 });
  }
}
