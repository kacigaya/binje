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

export const revalidate = 3600;

export default async function MoviesPage() {
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
    getTrending(),
    getPopular(),
    getTopRated(),
    getNowPlaying(),
    getUpcoming(),
    getMoviesByGenre(28),
    getMoviesByGenre(35),
    getMoviesByGenre(18),
    getMoviesByGenre(27),
    getMoviesByGenre(878),
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
            Movies
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      <Carousel
        title="Trending Movies"
        items={trending.map(movieToMedia)}
        priority
      />
      <LazyCarousel title="Popular Movies" items={popular.map(movieToMedia)} />
      <LazyCarousel title="Top Rated Movies" items={topRated.map(movieToMedia)} />
      <LazyCarousel title="Now Playing" items={nowPlaying.map(movieToMedia)} />
      <LazyCarousel title="Upcoming" items={upcoming.map(movieToMedia)} />
      <LazyCarousel title="Action" items={action.map(movieToMedia)} />
      <LazyCarousel title="Comedy" items={comedy.map(movieToMedia)} />
      <LazyCarousel title="Drama" items={drama.map(movieToMedia)} />
      <LazyCarousel title="Horror" items={horror.map(movieToMedia)} />
      <LazyCarousel title="Sci-Fi" items={scifi.map(movieToMedia)} />
    </div>
  );
}
