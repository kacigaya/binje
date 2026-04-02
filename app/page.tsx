import Hero from "@/components/Hero";
import Carousel from "@/components/Carousel";
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
  movieToMedia,
  tvToMedia,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

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

  const featured = movieToMedia(trending[0]);

  return (
    <div className="flex flex-col">
      {featured && <Hero item={featured} />}

      <div className="-mt-16 relative z-10 flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full">
        <Carousel
          title="Trending Movies"
          items={trending.map(movieToMedia)}
        />
        <Carousel
          title="Trending TV Shows"
          items={trendingTV.map(tvToMedia)}
        />
        <Carousel title="Popular Movies" items={popular.map(movieToMedia)} />
        <Carousel
          title="Popular TV Shows"
          items={popularTV.map(tvToMedia)}
        />
        <Carousel
          title="Top Rated Movies"
          items={topRated.map(movieToMedia)}
        />
        <Carousel
          title="Top Rated TV"
          items={topRatedTV.map(tvToMedia)}
        />
        <Carousel title="Now Playing" items={nowPlaying.map(movieToMedia)} />
        <Carousel
          title="On The Air"
          items={onTheAirTV.map(tvToMedia)}
        />
        <Carousel title="Upcoming" items={upcoming.map(movieToMedia)} />
        <Carousel title="Action" items={action.map(movieToMedia)} />
        <Carousel title="Comedy" items={comedy.map(movieToMedia)} />
        <Carousel title="Horror" items={horror.map(movieToMedia)} />
        <Carousel title="Sci-Fi" items={scifi.map(movieToMedia)} />
      </div>
    </div>
  );
}
