import Image from "next/image";
import Link from "next/link";
import { Play, Star, Calendar, Tv, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import {
  getTVDetails,
  getTVCredits,
  getSimilarTV,
  tvToMedia,
  posterUrl,
  backdropUrl,
  profileUrl,
} from "@/lib/tmdb";

export default async function TVShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const showId = parseInt(id, 10);

  const [show, credits, similar] = await Promise.all([
    getTVDetails(showId),
    getTVCredits(showId),
    getSimilarTV(showId),
  ]);

  const backdrop = backdropUrl(show.backdrop_path);
  const poster = posterUrl(show.poster_path, "w500");
  const topCast = credits.cast.slice(0, 12);

  return (
    <div className="flex flex-col">
      {/* Backdrop */}
      <div className="relative w-full h-[50vh] sm:h-[60vh]">
        {backdrop && (
          <Image
            src={backdrop}
            alt={show.name}
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
                alt={show.name}
                fill
                priority
                className="object-cover"
                sizes="260px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
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

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {show.name}
            </h1>

            {show.tagline && (
              <p className="text-lg text-accent-red/80 italic">
                {show.tagline}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1 text-accent-red font-semibold">
                <Star className="h-4 w-4 fill-accent-red" />
                {show.vote_average.toFixed(1)}
                <span className="text-muted-foreground font-normal ml-1">
                  ({show.vote_count.toLocaleString()} votes)
                </span>
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
                  {new Date(show.first_air_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
              {show.status && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    show.status === "Returning Series"
                      ? "border-green-500/40 text-green-400"
                      : "border-white/15 text-foreground/60"
                  }`}
                >
                  {show.status}
                </Badge>
              )}
            </div>

            {/* Watch button */}
            <Link href={`/watch/tv/${show.id}`}>
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
                {show.overview}
              </p>
            </div>

            {/* Created by */}
            {show.created_by.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Created by
                </span>
                <p className="font-medium">
                  {show.created_by.map((c) => c.name).join(", ")}
                </p>
              </div>
            )}

            {/* Networks */}
            {show.networks.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Network</span>
                <p className="font-medium">
                  {show.networks.map((n) => n.name).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Seasons */}
        {show.seasons.length > 0 && (
          <div className="mt-12">
            <h3
              className="text-xl font-bold mb-6"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Seasons
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {show.seasons
                .filter((s) => s.season_number > 0)
                .map((season) => {
                  const sPoster = posterUrl(season.poster_path, "w300");
                  return (
                    <Link
                      key={season.id}
                      href={`/watch/tv/${show.id}?s=${season.season_number}&e=1`}
                      className="group flex-shrink-0"
                    >
                      <div className="relative w-[140px] sm:w-[160px] overflow-hidden rounded-xl bg-card transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_0_20px_rgba(225,29,72,0.12)]">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl">
                          <Image
                            src={sPoster}
                            alt={season.name}
                            fill
                            className="object-cover"
                            sizes="160px"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-sm font-semibold text-white leading-tight">
                              {season.name}
                            </p>
                            <p className="text-xs text-white/60 mt-0.5">
                              {season.episode_count} episodes
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

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

        {/* Similar TV */}
        {similar.length > 0 && (
          <div className="mt-12">
            <Carousel title="Similar Shows" items={similar.map(tvToMedia)} />
          </div>
        )}
      </div>
    </div>
  );
}
