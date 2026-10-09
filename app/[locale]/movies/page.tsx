import type { Metadata } from "next";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import BrowseView, { BrowseViewSkeleton } from "@/components/BrowseView";
import {
  getMoviesByGenre,
  getNowPlaying,
  getPopular,
  getTopRated,
  getTrending,
  getUpcoming,
} from "@/lib/cached-tmdb";
import { movieToMedia } from "@/lib/tmdb";
import { isLocale, translate, type Locale, type TranslationKey } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "Movies") };
}

const SECTIONS = [
  ["Trending Movies", getTrending, true],
  ["Popular Movies", getPopular],
  ["Top Rated Movies", getTopRated],
  ["Now Playing", getNowPlaying],
  ["Upcoming", getUpcoming],
  ["Action", (locale: Locale) => getMoviesByGenre(28, locale)],
  ["Comedy", (locale: Locale) => getMoviesByGenre(35, locale)],
  ["Drama", (locale: Locale) => getMoviesByGenre(18, locale)],
  ["Horror", (locale: Locale) => getMoviesByGenre(27, locale)],
  ["Sci-Fi", (locale: Locale) => getMoviesByGenre(878, locale)],
] as const;

async function MovieRail({
  locale,
  title,
  load,
  priority = false,
}: {
  locale: Locale;
  title: TranslationKey;
  load: (locale: Locale) => ReturnType<typeof getTrending>;
  priority?: boolean;
}) {
  const movies = await load(locale).catch(() => []);
  return (
    <Carousel
      title={translate(locale, title)}
      items={movies.map(movieToMedia)}
      priority={priority}
    />
  );
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl text-balance"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {translate(locale, "Movies")}
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      {/* Reading the query string makes the rest request-time, so it sits
          in its own boundary and the header stays in the static shell. */}
      <Suspense fallback={<BrowseViewSkeleton />}>
        <BrowseView
          type="movie"
          locale={locale}
          searchParams={searchParams}
          rails={SECTIONS.map(([title, load, priority]) => (
            <Suspense key={title} fallback={<CarouselSkeleton />}>
              <MovieRail
                locale={locale}
                title={title}
                load={load}
                priority={priority}
              />
            </Suspense>
          ))}
        />
      </Suspense>
    </div>
  );
}
