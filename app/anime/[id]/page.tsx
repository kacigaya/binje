import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Play, Star, Calendar, Tv, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import WatchlistButton from "@/components/WatchlistButton";
import {
  animeToMedia,
  getAnimeDetails,
  getAnimeRecommendations,
} from "@/lib/jikan";

function posterOf(anime: Awaited<ReturnType<typeof getAnimeDetails>>) {
  return (
    anime.images?.webp?.large_image_url ??
    anime.images?.jpg?.large_image_url ??
    null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const animeId = parseInt(id, 10);
  if (!Number.isFinite(animeId) || animeId <= 0) return {};
  try {
    const anime = await getAnimeDetails(animeId);
    return {
      title: `${anime.title_english || anime.title} — b!nje`,
      description: anime.synopsis ?? undefined,
    };
  } catch {
    return {};
  }
}

export const revalidate = 86400;

export default async function AnimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const animeId = parseInt(id, 10);
  if (!Number.isFinite(animeId) || animeId <= 0) notFound();

  let anime: Awaited<ReturnType<typeof getAnimeDetails>>;
  try {
    anime = await getAnimeDetails(animeId);
  } catch {
    notFound();
  }

  const recommendations = await getAnimeRecommendations(animeId);

  const title = anime.title_english || anime.title;
  const poster = posterOf(anime);
  const year = anime.year ?? (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null);
  const mediaItem = animeToMedia(anime);

  return (
    <div className="flex flex-col pt-16">
      <div className="relative -mt-16 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pt-28 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="relative w-50 sm:w-65 aspect-2/3 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
              {poster && (
                <Image
                  src={poster}
                  alt={title}
                  fill
                  priority
                  className="object-cover"
                  sizes="260px"
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {title}
            </h1>

            {anime.title_english && anime.title !== anime.title_english && (
              <p className="text-lg text-accent-red/80 italic">{anime.title}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-accent-red/90 text-white text-xs uppercase tracking-wider hover:bg-accent-red/80">
                Anime
              </Badge>
              {anime.genres.map((g) => (
                <Badge
                  key={g.mal_id}
                  variant="outline"
                  className="border-white/15 text-foreground/80 text-xs"
                >
                  {g.name}
                </Badge>
              ))}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {anime.score != null && (
                <div className="flex items-center gap-1 text-accent-red font-semibold">
                  <Star className="h-4 w-4 fill-accent-red" />
                  {anime.score.toFixed(1)}
                </div>
              )}
              {anime.type && (
                <div className="flex items-center gap-1">
                  <Clapperboard className="h-4 w-4" />
                  {anime.type}
                </div>
              )}
              {anime.episodes != null && (
                <div className="flex items-center gap-1">
                  <Tv className="h-4 w-4" />
                  {anime.episodes} Episodes
                </div>
              )}
              {year && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {year}
                </div>
              )}
              {anime.status && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    anime.status === "Currently Airing"
                      ? "border-green-500/40 text-green-400"
                      : "border-white/15 text-foreground/60"
                  }`}
                >
                  {anime.status}
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-2">
              <Link href={`/watch/anime/${anime.mal_id}?e=1`} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-10 h-12 text-base cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-white" />
                  Watch Now
                </Button>
              </Link>
              <WatchlistButton
                item={{
                  type: "anime",
                  id: anime.mal_id,
                  title,
                  poster_path: poster,
                  backdrop_path: null,
                  date: mediaItem.date,
                  vote_average: anime.score ?? 0,
                }}
              />
            </div>

            <div className="mt-6">
              <Separator className="bg-white/10" />
            </div>

            {/* Overview */}
            {anime.synopsis && (
              <div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Overview
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  {anime.synopsis}
                </p>
              </div>
            )}

            {anime.studios && anime.studios.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Studio</span>
                <p className="font-medium">
                  {anime.studios.map((s) => s.name).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-12">
            <Carousel
              title="Recommended"
              items={recommendations.map(animeToMedia)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
