import Image from "next/image";
import Link from "next/link";
import { Play, Star, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import {
  getMovieDetails,
  getMovieCredits,
  getSimilarMovies,
  movieToMedia,
  posterUrl,
  backdropUrl,
  profileUrl,
} from "@/lib/tmdb";

export default async function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movieId = parseInt(id, 10);

  const [movie, credits, similar] = await Promise.all([
    getMovieDetails(movieId),
    getMovieCredits(movieId),
    getSimilarMovies(movieId),
  ]);

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w500");
  const director = credits.crew.find((c) => c.job === "Director");
  const topCast = credits.cast.slice(0, 12);

  return (
    <div className="flex flex-col">
      {/* Backdrop */}
      <div className="relative w-full h-[50vh] sm:h-[60vh]">
        {backdrop && (
          <Image
            src={backdrop}
            alt={movie.title}
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>

      {/* Content */}
      <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            <div className="relative w-[200px] sm:w-[260px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
              <Image
                src={poster}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="260px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <Badge
                  key={g.id}
                  variant="outline"
                  className="border-white/15 text-foreground/80 text-xs"
                >
                  {g.name}
                </Badge>
              ))}
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="text-lg text-accent-red/80 italic">
                {movie.tagline}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1 text-accent-red font-semibold">
                <Star className="h-4 w-4 fill-accent-red" />
                {movie.vote_average.toFixed(1)}
                <span className="text-muted-foreground font-normal ml-1">
                  ({movie.vote_count.toLocaleString()} votes)
                </span>
              </div>
              {movie.runtime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </div>
              )}
              {movie.release_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(movie.release_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>

            {/* Watch button */}
            <Link href={`/watch/${movie.id}`}>
              <Button
                size="lg"
                className="rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-10 h-12 text-base mt-2 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-white" />
                Watch Now
              </Button>
            </Link>

            <div className="mt-6">
              <Separator className="bg-white/10" />
            </div>

            {/* Overview */}
            <div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Overview
              </h3>
              <p className="text-foreground/70 leading-relaxed">
                {movie.overview}
              </p>
            </div>

            {/* Director */}
            {director && (
              <div>
                <span className="text-sm text-muted-foreground">Director</span>
                <p className="font-medium">{director.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cast */}
        {topCast.length > 0 && (
          <div className="mt-12">
            <h3
              className="text-xl font-bold mb-6 px-0"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Cast
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {topCast.map((person, i) => {
                const photo = profileUrl(person.profile_path);
                return (
                  <div
                    key={`${person.id}-${i}`}
                    className="flex-shrink-0 w-[110px] text-center"
                  >
                    <div className="relative w-[110px] h-[110px] rounded-full overflow-hidden bg-muted mx-auto mb-2">
                      {photo ? (
                        <Image
                          src={photo}
                          alt={person.name}
                          fill
                          className="object-cover"
                          sizes="110px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground font-bold">
                          {person.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-tight line-clamp-1">
                      {person.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {person.character}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Similar movies */}
        {similar.length > 0 && (
          <div className="mt-12">
            <Carousel
              title="Similar Movies"
              items={similar.map(movieToMedia)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
