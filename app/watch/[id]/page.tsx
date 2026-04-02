import Link from "next/link";
import { ArrowLeft, Star, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Player from "@/components/Player";
import { getMovieDetails } from "@/lib/tmdb";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movieId = parseInt(id, 10);
  const movie = await getMovieDetails(movieId);

  return (
    <div className="flex flex-col pt-16">
      {/* Player */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 sm:pt-6">
        <Player tmdbId={movie.id} type="movie" />
      </div>

      {/* Movie info below player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
        <Link
          href={`/movie/${movie.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to details
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

        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {movie.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1 text-amber font-semibold">
            <Star className="h-4 w-4 fill-amber" />
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

        <p className="text-foreground/70 leading-relaxed max-w-3xl">
          {movie.overview}
        </p>
      </div>
    </div>
  );
}
