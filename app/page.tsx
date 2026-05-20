import Hero from "@/components/Hero";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import ContinueWatching from "@/components/ContinueWatching";
import {
  getTrending,
  getPopular,
  getTopRated,
  getNowPlaying,
  getUpcoming,
  getMoviesByGenre,
  getTrendingTV,
  getPopularTV,
  getTopRatedTV,
  getOnTheAirTV,
  getMovieImages,
  movieToMedia,
  pickMovieLogo,
  tvToMedia,
} from "@/lib/tmdb";

export const revalidate = 3600;

export default async function HomePage() {
  const [
    trending,
    popular,
    topRated,
    nowPlaying,
    upcoming,
    action,
    comedy,
    horror,
    scifi,
    trendingTV,
    popularTV,
    topRatedTV,
    onTheAirTV,
  ] = await Promise.all([
    getTrending(),
    getPopular(),
    getTopRated(),
    getNowPlaying(),
    getUpcoming(),
    getMoviesByGenre(28),
    getMoviesByGenre(35),
    getMoviesByGenre(27),
    getMoviesByGenre(878),
    getTrendingTV(),
    getPopularTV(),
    getTopRatedTV(),
    getOnTheAirTV(),
  ]);

  const featuredItems = await Promise.all(
    trending.map(async (movie) => {
      const item = movieToMedia(movie);

      try {
        const images = await getMovieImages(movie.id);
        const logo = pickMovieLogo(images.logos);

        if (!logo) return item;

        return {
          ...item,
          logo_path: logo.file_path,
          logo_width: logo.width,
          logo_height: logo.height,
        };
      } catch {
        return item;
      }
    }),
  );

  return (
    <div className="flex flex-col">
      {featuredItems.length > 0 && <Hero items={featuredItems} />}

      <div className="-mt-12 relative z-10 flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full">
        <ContinueWatching />

        {/* Above-the-fold carousels: rendered immediately with priority images */}
        <Carousel title="Trending Movies" items={trending.map(movieToMedia)} priority />
        <Carousel title="Trending TV Shows" items={trendingTV.map(tvToMedia)} />

        {/* Below-the-fold carousels: deferred until near the viewport */}
        <LazyCarousel title="Popular Movies" items={popular.map(movieToMedia)} />
        <LazyCarousel title="Popular TV Shows" items={popularTV.map(tvToMedia)} />
        <LazyCarousel title="Top Rated Movies" items={topRated.map(movieToMedia)} />
        <LazyCarousel title="Top Rated TV" items={topRatedTV.map(tvToMedia)} />
        <LazyCarousel title="Now Playing" items={nowPlaying.map(movieToMedia)} />
        <LazyCarousel title="On The Air" items={onTheAirTV.map(tvToMedia)} />
        <LazyCarousel title="Upcoming" items={upcoming.map(movieToMedia)} />
        <LazyCarousel title="Action" items={action.map(movieToMedia)} />
        <LazyCarousel title="Comedy" items={comedy.map(movieToMedia)} />
        <LazyCarousel title="Horror" items={horror.map(movieToMedia)} />
        <LazyCarousel title="Sci-Fi" items={scifi.map(movieToMedia)} />
      </div>
    </div>
  );
}
