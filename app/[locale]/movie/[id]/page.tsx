import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Play, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import WatchlistButton from "@/components/WatchlistButton";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";
import {
  getMovieDetails,
  getMovieContentRating,
  getMovieCredits,
  getSimilarMovies,
  movieToMedia,
  posterUrl,
  backdropUrl,
  profileUrl,
} from "@/lib/tmdb";
import { localizedHref, translate, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const movieId = parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) return {};
  const movie = await getMovieDetails(movieId, locale);
  return {
    title: movie.title,
    description: movie.overview,
  };
}

export default async function MoviePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) notFound();

  const moviePromise = getMovieDetails(movieId, locale);
  const [movie, credits, similar, rottenTomatoesScore] = await Promise.all([
    moviePromise,
    getMovieCredits(movieId, locale),
    getSimilarMovies(movieId, locale),
    moviePromise.then(({ imdb_id }) => getRottenTomatoesScore(imdb_id)),
  ]);

  const backdrop = backdropUrl(movie.backdrop_path, "w1280");
  const poster = posterUrl(movie.poster_path, "w500");
  const director = credits.crew.find((c) => c.job === "Director");
  const topCast = credits.cast.slice(0, 12);
  const contentRating = getMovieContentRating(movie);

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
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/30" />
      </div>

      {/* Content */}
      <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="relative w-50 sm:w-65 aspect-2/3 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
              <Image
                src={poster}
                alt={movie.title}
                fill
                priority
                className="object-cover"
                sizes="260px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-balance"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="text-lg text-accent-red/80 italic">
                {movie.tagline}
              </p>
            )}

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

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground tabular-nums">
              <div className="flex items-center gap-1.5 text-accent-red font-semibold">
                <Image
                  src="/tmdb.svg"
                  alt=""
                  width={37}
                  height={16}
                  aria-hidden="true"
                  className="h-4 w-auto shrink-0"
                />
                {movie.vote_average.toFixed(1)}
              </div>
              {rottenTomatoesScore !== null && (
                <div className="flex items-center gap-1.5 font-semibold text-accent-red">
                  <Image
                    src="/rotten-tomatoes.svg"
                    alt=""
                    width={16}
                    height={16}
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  {rottenTomatoesScore}%
                </div>
              )}
              {contentRating && (
                <div className="font-semibold text-accent-red">{contentRating}</div>
              )}
              {movie.runtime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </div>
              )}
              {movie.release_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  {new Date(movie.release_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-2">
              <Link href={localizedHref(locale, `/watch/${movie.id}`)} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-10 h-12 text-base cursor-pointer"
                >
                  <Play className="size-5 fill-white" />
                  {translate(locale, "Watch Now")}
                </Button>
              </Link>
              <WatchlistButton
                item={{
                  type: "movie",
                  id: movie.id,
                  title: movie.title,
                  poster_path: movie.poster_path,
                  backdrop_path: movie.backdrop_path,
                  date: movie.release_date,
                  vote_average: movie.vote_average,
                }}
              />
            </div>

            <div className="mt-6">
              <Separator className="bg-white/10" />
            </div>

            {/* Overview */}
            <div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {translate(locale, "Overview")}
              </h3>
              <p className="text-foreground/70 leading-relaxed">
                {movie.overview}
              </p>
            </div>

            {/* Director */}
            {director && (
              <div>
                <span className="text-sm text-muted-foreground">{translate(locale, "Director")}</span>
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
              {translate(locale, "Cast")}
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {topCast.map((person, i) => {
                const photo = profileUrl(person.profile_path);
                return (
                  <div
                    key={`${person.id}-${i}`}
                    className="shrink-0 w-27.5 text-center"
                  >
                    <div className="relative size-27.5 rounded-full overflow-hidden bg-muted mx-auto mb-2">
                      {photo ? (
                        <Image
                          src={photo}
                          alt={person.name}
                          fill
                          loading="lazy"
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
              title={translate(locale, "Similar Movies")}
              items={similar.map(movieToMedia)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
