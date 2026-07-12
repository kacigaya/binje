import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Star, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Player from "@/components/Player";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import {
  getMovieDetails,
  getMovieContentRating,
  getMovieImages,
  logoUrl,
  pickMovieLogo,
} from "@/lib/tmdb";
import type { Locale } from "@/lib/i18n";

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
  const [movie, images] = await Promise.all([
    getMovieDetails(movieId, locale),
    getMovieImages(movieId, locale),
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
          {logo && movieLogoUrl && (
            <Image
              src={movieLogoUrl}
              alt={`${movie.title} logo`}
              width={logo.width}
              height={logo.height}
              className="h-auto max-h-24 w-auto max-w-xs object-contain sm:max-w-md"
              priority
            />
          )}

          {!logo && (
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {movie.title}
            </h1>
          )}

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

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1 text-accent-red font-semibold">
              <Star className="h-4 w-4 fill-accent-red" />
              {movie.vote_average.toFixed(1)}
            </div>
            {contentRating && (
              <div className="font-semibold text-accent-red">{contentRating}</div>
            )}
            {movie.runtime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
              </div>
            )}
            {movie.release_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(movie.release_date).getFullYear()}
              </div>
            )}
          </div>

          <p className="text-foreground/70 leading-relaxed">{movie.overview}</p>
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
