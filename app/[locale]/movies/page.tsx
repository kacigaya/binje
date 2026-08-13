import type { Metadata } from "next";
import { Suspense } from "react";
import { Clapperboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import AsyncCarousel from "@/components/AsyncCarousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import {
  getMoviesByGenre,
  getNowPlaying,
  getPopular,
  getTopRated,
  getTrending,
  getUpcoming,
  movieToMedia,
} from "@/lib/tmdb";
import type { Movie } from "@/types/tmdb";
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "Movies") };
}

export default async function MoviesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const trendingPromise = getTrending(locale);
  // Every rail starts fetching now and is awaited later, inside its own
  // Suspense boundary. If the trending await below throws first, nothing ever
  // awaits these, and an unhandled rejection takes the process down, so each
  // one absorbs its own failure and renders as an empty rail.
  const rail = (request: Promise<Movie[]>) => request.catch((): Movie[] => []);
  const sections = [
    ["Popular Movies", rail(getPopular(locale))],
    ["Top Rated Movies", rail(getTopRated(locale))],
    ["Now Playing", rail(getNowPlaying(locale))],
    ["Upcoming", rail(getUpcoming(locale))],
    ["Action", rail(getMoviesByGenre(28, locale))],
    ["Comedy", rail(getMoviesByGenre(35, locale))],
    ["Drama", rail(getMoviesByGenre(18, locale))],
    ["Horror", rail(getMoviesByGenre(27, locale))],
    ["Sci-Fi", rail(getMoviesByGenre(878, locale))],
  ] as const;
  const trending = await trendingPromise;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Clapperboard className="size-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl text-balance"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {translate(locale, "Movies")}
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      <Carousel
        title={translate(locale, "Trending Movies")}
        items={trending.map(movieToMedia)}
        priority
      />
      {sections.map(([title, items]) => (
        <Suspense key={title} fallback={<CarouselSkeleton />}>
          <AsyncCarousel
            title={translate(locale, title)}
            items={items.then((movies) => movies.map(movieToMedia))}
          />
        </Suspense>
      ))}
    </div>
  );
}
