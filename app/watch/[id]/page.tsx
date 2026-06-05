import { notFound } from "next/navigation";
import Image from "next/image";
import { Star, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Player from "@/components/Player";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import {
  getMovieDetails,
  getMovieImages,
  logoUrl,
  pickMovieLogo,
} from "@/lib/tmdb";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movieId = parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) notFound();
  const [movie, images] = await Promise.all([
    getMovieDetails(movieId),
    getMovieImages(movieId),
  ]);
  const logo = pickMovieLogo(images.logos);
  const movieLogoUrl = logoUrl(logo?.file_path ?? null);

  return (
    <div className="flex flex-col pt-16">
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
        <Player tmdbId={movie.id} type="movie" />
      </div>
    </div>
  );
}
