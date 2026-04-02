import Link from "next/link";
import { ArrowLeft, Star, Calendar, Layers, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTVDetails } from "@/lib/tmdb";
import TVPlayer from "./TVPlayer";

export default async function WatchTVPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
  const { id } = await params;
  const { s, e } = await searchParams;
  const showId = parseInt(id, 10);
  const show = await getTVDetails(showId);

  const season = s ? parseInt(s, 10) : 1;
  const episode = e ? parseInt(e, 10) : 1;

  const seasons = show.seasons.filter((ss) => ss.season_number > 0);

  return (
    <div className="flex flex-col pt-16">
      {/* Player */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 sm:pt-6">
        <TVPlayer
          showId={show.id}
          season={season}
          episode={episode}
          seasons={seasons.map((ss) => ({
            season_number: ss.season_number,
            name: ss.name,
            episode_count: ss.episode_count,
          }))}
        />
      </div>

      {/* Show info below player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
        <Link
          href={`/tv/${show.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to details
        </Link>

        <div className="flex flex-wrap gap-2">
          <Badge className="bg-amber/90 text-black text-xs uppercase tracking-wider hover:bg-amber/80">
            TV Series
          </Badge>
          {show.genres.map((g) => (
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
          {show.name}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1 text-amber font-semibold">
            <Star className="h-4 w-4 fill-amber" />
            {show.vote_average.toFixed(1)}
          </div>
          <div className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1">
            <Tv className="h-4 w-4" />
            {show.number_of_episodes} Episodes
          </div>
          {show.first_air_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(show.first_air_date).getFullYear()}
            </div>
          )}
        </div>

        <p className="text-foreground/70 leading-relaxed max-w-3xl">
          {show.overview}
        </p>
      </div>
    </div>
  );
}
