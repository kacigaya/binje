import { notFound } from "next/navigation";
import Image from "next/image";
import { Star, Calendar, Layers, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getTVDetails,
  getTVImages,
  getSeasonEpisodes,
  logoUrl,
  pickTVLogo,
} from "@/lib/tmdb";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
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
  if (!Number.isFinite(showId) || showId <= 0) notFound();
  const [show, images] = await Promise.all([
    getTVDetails(showId),
    getTVImages(showId),
  ]);
  const logo = pickTVLogo(images.logos);
  const showLogoUrl = logoUrl(logo?.file_path ?? null);

  const season = s ? parseInt(s, 10) : 1;
  const episode = e ? parseInt(e, 10) : 1;

  const seasons = show.seasons.filter((ss) => ss.season_number > 0);

  const initialEpisodes = await getSeasonEpisodes(showId, season).catch(
    () => [],
  );

  return (
    <div className="flex flex-col pt-16">
      <PlayHistoryRecorder
        item={{
          type: "tv",
          id: show.id,
          title: show.name,
          poster_path: show.poster_path,
          backdrop_path: show.backdrop_path,
          date: show.first_air_date,
          vote_average: show.vote_average,
          season,
          episode,
        }}
      />

      {/* Show info above player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          {logo && showLogoUrl && (
            <Image
              src={showLogoUrl}
              alt={`${show.name} logo`}
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
              {show.name}
            </h1>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge className="bg-accent-red/90 text-white text-xs uppercase tracking-wider hover:bg-accent-red/80">
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

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1 text-accent-red font-semibold">
              <Star className="h-4 w-4 fill-accent-red" />
              {show.vote_average.toFixed(1)}
            </div>
            <div className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              {show.number_of_seasons} Season
              {show.number_of_seasons !== 1 ? "s" : ""}
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

          <p className="text-foreground/70 leading-relaxed">{show.overview}</p>
        </div>
      </div>

      {/* Player */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8">
        <TVPlayer
          showId={show.id}
          title={show.name}
          year={
            show.first_air_date
              ? new Date(show.first_air_date).getFullYear()
              : undefined
          }
          season={season}
          episode={episode}
          seasons={seasons.map((ss) => ({
            season_number: ss.season_number,
            name: ss.name,
            episode_count: ss.episode_count,
          }))}
          initialEpisodes={initialEpisodes}
        />
      </div>
    </div>
  );
}
