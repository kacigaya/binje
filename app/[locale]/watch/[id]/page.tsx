import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, Calendar } from "lucide-react";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";
import StreamTechBadges from "@/components/StreamTechBadges";
import { Badge } from "@/components/ui/badge";
import Player from "@/components/Player";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import ExpandableOverview from "@/components/ExpandableOverview";
import {
  getMovieDetails,
  getMovieContentRating,
  getMovieImages,
  logoUrl,
  pickMovieLogo,
} from "@/lib/tmdb";
import { localizedHref, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const movieId = parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) return {};
  const movie = await getMovieDetails(movieId, locale);
  return { title: movie.title, description: movie.overview };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) notFound();
  const moviePromise = getMovieDetails(movieId, locale);
  const [movie, images, rottenTomatoesScore] = await Promise.all([
    moviePromise,
    getMovieImages(movieId, locale),
    moviePromise.then(({ imdb_id }) => getRottenTomatoesScore(imdb_id)),
  ]);
  const logo = pickMovieLogo(images.logos, locale);
  const movieLogoUrl = logoUrl(logo?.file_path ?? null);
  const contentRating = getMovieContentRating(movie);

  return (
    <div className="flex flex-col pt-20">
      <PlayHistoryRecorder
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

      {/* Movie info above player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          <Link
            href={localizedHref(locale, `/movie/${movie.id}`)}
            className="inline-block"
            aria-label={movie.title}
          >
            {logo && movieLogoUrl ? (
              <Image
                src={movieLogoUrl}
                alt={`${movie.title} logo`}
                width={logo.width}
                height={logo.height}
                className="h-auto max-h-24 w-auto max-w-xs object-contain sm:max-w-md"
                priority
              />
            ) : (
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {movie.title}
              </h1>
            )}
          </Link>

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
                {new Date(movie.release_date).getFullYear()}
              </div>
            )}
            <StreamTechBadges
              type="movie"
              tmdbId={movie.id}
              title={movie.original_title}
              year={movie.release_date.slice(0, 4)}
              imdbId={movie.imdb_id}
            />
          </div>

          <ExpandableOverview
            text={movie.overview}
            className="text-foreground/70 leading-relaxed"
          />
        </div>
      </div>

      {/* Player */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8">
        <Player
          tmdbId={movie.id}
          title={movie.original_title}
          year={movie.release_date.slice(0, 4)}
          imdbId={movie.imdb_id}
          type="movie"
        />
      </div>
    </div>
  );
}
