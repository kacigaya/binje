import Hero from "@/components/Hero";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import ContinueWatching from "@/components/ContinueWatching";
import HeroSkeleton from "@/components/HeroSkeleton";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import {
  getMovieImages,
  getMovieDetails,
  getTrending,
  getTrendingTV,
} from "@/lib/cached-tmdb";
import {
  getMovieContentRating,
  movieToMedia,
  pickLogo,
  tvToMedia,
} from "@/lib/tmdb";
import { isLocale, translate, type Locale } from "@/lib/i18n";

const FEATURED_ITEM_COUNT = 5;

async function FeaturedHero({ locale }: { locale: Locale }) {
  const trending = await getTrending(locale);
  const featuredItems = await Promise.all(
    trending.slice(0, FEATURED_ITEM_COUNT).map(async (movie) => {
      const item = movieToMedia(movie);

      const [images, details] = await Promise.all([
        getMovieImages(movie.id, locale).catch(() => null),
        getMovieDetails(movie.id, locale).catch(() => null),
      ]);
      const logo = images ? pickLogo(images.logos, locale) : null;
      return {
        ...item,
        imdbId: details?.imdb_id ?? null,
        contentRating: details ? getMovieContentRating(details) : null,
        ...(logo && {
          logo_path: logo.file_path,
          logo_width: logo.width,
          logo_height: logo.height,
        }),
      };
    }),
  );

  return featuredItems.length > 0 ? <Hero items={featuredItems} /> : null;
}

async function TrendingMovies({ locale }: { locale: Locale }) {
  const trending = await getTrending(locale);
  return (
    <Carousel
      title={translate(locale, "Trending Movies")}
      items={trending.map(movieToMedia)}
      priority
    />
  );
}

async function TrendingTV({ locale }: { locale: Locale }) {
  const trendingTV = await getTrendingTV(locale);
  return (
    <Carousel
      title={translate(locale, "Trending TV Shows")}
      items={trendingTV.map(tvToMedia)}
    />
  );
}

export default async function HomePage() {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <div className="flex flex-col">
      <Suspense fallback={<HeroSkeleton />}>
        <FeaturedHero locale={locale} />
      </Suspense>

      <div className="-mt-12 relative z-10 flex w-full max-w-7xl flex-col gap-10 px-0 pb-16 mx-auto">
        <ContinueWatching />
        <Suspense fallback={<CarouselSkeleton />}>
          <TrendingMovies locale={locale} />
        </Suspense>
        <Suspense fallback={<CarouselSkeleton />}>
          <TrendingTV locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
