import { Tv } from "lucide-react";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import {
  getAiringTodayTV,
  getOnTheAirTV,
  getPopularTV,
  getTopRatedTV,
  getTrendingTV,
  getTVByGenre,
  tvToMedia,
} from "@/lib/tmdb";

export const revalidate = 3600;

export default async function TVShowsPage() {
  const [
    trending,
    popular,
    topRated,
    airingToday,
    onTheAir,
    actionAdventure,
    comedy,
    drama,
    scifiFantasy,
    documentary,
  ] = await Promise.all([
    getTrendingTV(),
    getPopularTV(),
    getTopRatedTV(),
    getAiringTodayTV(),
    getOnTheAirTV(),
    getTVByGenre(10759),
    getTVByGenre(35),
    getTVByGenre(18),
    getTVByGenre(10765),
    getTVByGenre(99),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="relative px-4 sm:px-6">
        <div className="pointer-events-none absolute -left-2 -top-12 h-44 w-44 rounded-full bg-accent-red/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Tv className="h-9 w-9 shrink-0 text-accent-red drop-shadow-[0_0_12px_rgba(225,29,72,0.5)] sm:h-11 sm:w-11" />
          <div>
            <h1
              className="bg-linear-to-r from-white via-white to-accent-red bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              TV Shows
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Series worth bingeing, fresh and timeless
            </p>
          </div>
        </div>
        <div className="mt-5 h-px w-full bg-linear-to-r from-accent-red/70 via-accent-red/15 to-transparent" />
      </header>

      <Carousel
        title="Trending TV Shows"
        items={trending.map(tvToMedia)}
        priority
      />
      <LazyCarousel title="Popular TV Shows" items={popular.map(tvToMedia)} />
      <LazyCarousel title="Top Rated TV Shows" items={topRated.map(tvToMedia)} />
      <LazyCarousel title="Airing Today" items={airingToday.map(tvToMedia)} />
      <LazyCarousel title="On The Air" items={onTheAir.map(tvToMedia)} />
      <LazyCarousel
        title="Action & Adventure"
        items={actionAdventure.map(tvToMedia)}
      />
      <LazyCarousel title="Comedy" items={comedy.map(tvToMedia)} />
      <LazyCarousel title="Drama" items={drama.map(tvToMedia)} />
      <LazyCarousel title="Sci-Fi & Fantasy" items={scifiFantasy.map(tvToMedia)} />
      <LazyCarousel title="Documentary" items={documentary.map(tvToMedia)} />
    </div>
  );
}
