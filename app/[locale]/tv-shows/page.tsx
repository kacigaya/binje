import type { Metadata } from "next";
import { Suspense } from "react";
import { Tv } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import AsyncCarousel from "@/components/AsyncCarousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import {
  getAiringTodayTV,
  getOnTheAirTV,
  getPopularTV,
  getTopRatedTV,
  getTrendingTV,
  getTVByGenre,
  tvToMedia,
} from "@/lib/tmdb";
import type { TVShow } from "@/types/tmdb";
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "TV Shows") };
}

export default async function TVShowsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const trendingPromise = getTrendingTV(locale);
  // Every rail starts fetching now and is awaited later, inside its own
  // Suspense boundary. If the trending await below throws first, nothing ever
  // awaits these, and an unhandled rejection takes the process down, so each
  // one absorbs its own failure and renders as an empty rail.
  const rail = (request: Promise<TVShow[]>) => request.catch((): TVShow[] => []);
  const sections = [
    ["Popular TV Shows", rail(getPopularTV(locale))],
    ["Top Rated TV Shows", rail(getTopRatedTV(locale))],
    ["Airing Today", rail(getAiringTodayTV(locale))],
    ["On The Air", rail(getOnTheAirTV(locale))],
    ["Action & Adventure", rail(getTVByGenre(10759, locale))],
    ["Comedy", rail(getTVByGenre(35, locale))],
    ["Drama", rail(getTVByGenre(18, locale))],
    ["Sci-Fi & Fantasy", rail(getTVByGenre(10765, locale))],
    ["Documentary", rail(getTVByGenre(99, locale))],
  ] as const;
  const trending = await trendingPromise;

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
      {sections.map(([title, items]) => (
        <Suspense key={title} fallback={<CarouselSkeleton />}>
          <AsyncCarousel
            title={translate(locale, title)}
            items={items.then((shows) => shows.map(tvToMedia))}
          />
        </Suspense>
      ))}
    </div>
  );
}
