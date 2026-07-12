import Hero from "@/components/Hero";
import Carousel from "@/components/Carousel";
import ContinueWatching from "@/components/ContinueWatching";
import {
  getMovieImages,
  getMovieDetails,
  getMovieContentRating,
  getTrending,
  getTrendingTV,
  movieToMedia,
  pickMovieLogo,
  tvToMedia,
} from "@/lib/tmdb";
import { translate, type Locale } from "@/lib/i18n";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";

export const revalidate = 3600;

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [trending, trendingTV] = await Promise.all([
    getTrending(locale),
    getTrendingTV(locale),
  ]);

  const featuredItems = await Promise.all(
    trending.map(async (movie) => {
      const item = movieToMedia(movie);

      const [images, details] = await Promise.all([
        getMovieImages(movie.id, locale).catch(() => null),
        getMovieDetails(movie.id, locale).catch(() => null),
      ]);
      const logo = images ? pickMovieLogo(images.logos, locale) : null;
      const rottenTomatoesScore = await getRottenTomatoesScore(
        details?.imdb_id,
      );

      return {
        ...item,
        rottenTomatoesScore,
        contentRating: details ? getMovieContentRating(details) : null,
        ...(logo && {
          logo_path: logo.file_path,
          logo_width: logo.width,
          logo_height: logo.height,
        }),
      };
    }),
  );

  return (
    <div className="flex flex-col">
      {featuredItems.length > 0 && <Hero items={featuredItems} />}

      <div className="-mt-12 relative z-10 flex w-full max-w-7xl flex-col gap-10 px-0 pb-16 mx-auto">
        <ContinueWatching />

        <Carousel
          title={translate(locale, "Trending Movies")}
          items={trending.map(movieToMedia)}
          priority
        />
        <Carousel title={translate(locale, "Trending TV Shows")} items={trendingTV.map(tvToMedia)} />
      </div>
    </div>
  );
}
