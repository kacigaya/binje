import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import {
  getMoviesByGenre,
  getNowPlaying,
  getPopular,
  getTopRated,
  getTrending,
  getUpcoming,
  movieToMedia,
} from "@/lib/tmdb";
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "Movies") };
}

export default async function MoviesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [
    trending,
    popular,
    topRated,
    nowPlaying,
    upcoming,
    action,
    comedy,
    drama,
    horror,
    scifi,
  ] = await Promise.all([
    getTrending(locale),
    getPopular(locale),
    getTopRated(locale),
    getNowPlaying(locale),
    getUpcoming(locale),
    getMoviesByGenre(28, locale),
    getMoviesByGenre(35, locale),
    getMoviesByGenre(18, locale),
    getMoviesByGenre(27, locale),
    getMoviesByGenre(878, locale),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Clapperboard className="h-7 w-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl"
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
      <LazyCarousel title={translate(locale, "Popular Movies")} items={popular.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Top Rated Movies")} items={topRated.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Now Playing")} items={nowPlaying.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Upcoming")} items={upcoming.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Action")} items={action.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Comedy")} items={comedy.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Drama")} items={drama.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Horror")} items={horror.map(movieToMedia)} />
      <LazyCarousel title={translate(locale, "Sci-Fi")} items={scifi.map(movieToMedia)} />
    </div>
  );
}
