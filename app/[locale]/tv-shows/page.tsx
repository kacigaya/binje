import type { Metadata } from "next";
import { Tv } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "TV Shows") };
}

export default async function TVShowsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
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
    getTrendingTV(locale),
    getPopularTV(locale),
    getTopRatedTV(locale),
    getAiringTodayTV(locale),
    getOnTheAirTV(locale),
    getTVByGenre(10759, locale),
    getTVByGenre(35, locale),
    getTVByGenre(18, locale),
    getTVByGenre(10765, locale),
    getTVByGenre(99, locale),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Tv className="size-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl text-balance"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {translate(locale, "TV Shows")}
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      <Carousel
        title={translate(locale, "Trending TV Shows")}
        items={trending.map(tvToMedia)}
        priority
      />
      <LazyCarousel title={translate(locale, "Popular TV Shows")} items={popular.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "Top Rated TV Shows")} items={topRated.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "Airing Today")} items={airingToday.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "On The Air")} items={onTheAir.map(tvToMedia)} />
      <LazyCarousel
        title={translate(locale, "Action & Adventure")}
        items={actionAdventure.map(tvToMedia)}
      />
      <LazyCarousel title={translate(locale, "Comedy")} items={comedy.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "Drama")} items={drama.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "Sci-Fi & Fantasy")} items={scifiFantasy.map(tvToMedia)} />
      <LazyCarousel title={translate(locale, "Documentary")} items={documentary.map(tvToMedia)} />
    </div>
  );
}
