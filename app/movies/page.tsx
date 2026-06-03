import { Clapperboard } from "lucide-react";
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
      <header className="relative px-4 sm:px-6">
        <div className="pointer-events-none absolute -left-2 -top-12 h-44 w-44 rounded-full bg-accent-red/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Clapperboard className="h-9 w-9 shrink-0 text-accent-red drop-shadow-[0_0_12px_rgba(225,29,72,0.5)] sm:h-11 sm:w-11" />
          <div>
            <h1
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Movies
            </h1>
          </div>
        </div>
        <div className="mt-5 h-px w-full bg-linear-to-r from-accent-red/70 via-accent-red/15 to-transparent" />
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
