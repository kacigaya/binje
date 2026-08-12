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
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "TV Shows") };
}

export default async function TVShowsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const trendingPromise = getTrendingTV(locale);
  const sections = [
    ["Popular TV Shows", getPopularTV(locale)],
    ["Top Rated TV Shows", getTopRatedTV(locale)],
    ["Airing Today", getAiringTodayTV(locale)],
    ["On The Air", getOnTheAirTV(locale)],
    ["Action & Adventure", getTVByGenre(10759, locale)],
    ["Comedy", getTVByGenre(35, locale)],
    ["Drama", getTVByGenre(18, locale)],
    ["Sci-Fi & Fantasy", getTVByGenre(10765, locale)],
    ["Documentary", getTVByGenre(99, locale)],
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
