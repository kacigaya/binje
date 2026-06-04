import { notFound } from "next/navigation";
import { Star, Calendar, Tv, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAnimeDetails, getAnimeEpisodes } from "@/lib/jikan";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import AnimePlayer, { type AnimeEpisode } from "./AnimePlayer";

export default async function WatchAnimePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; dub?: string }>;
}) {
  const { id } = await params;
  const { e, dub } = await searchParams;
  const malId = parseInt(id, 10);
  if (!Number.isFinite(malId) || malId <= 0) notFound();

  let anime: Awaited<ReturnType<typeof getAnimeDetails>>;
  try {
    anime = await getAnimeDetails(malId);
  } catch {
    notFound();
  }

  const episode = e ? Math.max(parseInt(e, 10) || 1, 1) : 1;
  const isDub = dub === "1" || dub === "true";

  // First two pages cover up to ~200 episodes; longer series fall back to
  // numbered entries generated from the total episode count.
  const [page1, page2] = await Promise.all([
    getAnimeEpisodes(malId, 1).catch(() => ({ episodes: [], hasNextPage: false })),
    getAnimeEpisodes(malId, 2).catch(() => ({ episodes: [], hasNextPage: false })),
  ]);

  const episodes: AnimeEpisode[] = [...page1.episodes, ...page2.episodes].map(
    (ep) => ({ number: ep.mal_id, title: ep.title, filler: ep.filler }),
  );

  const title = anime.title_english || anime.title;
  const poster =
    anime.images?.webp?.large_image_url ??
    anime.images?.jpg?.large_image_url ??
    null;
  const year =
    anime.year ??
    (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null);

  return (
    <div className="flex flex-col pt-16">
      <PlayHistoryRecorder
        item={{
          type: "anime",
          id: anime.mal_id,
          title,
          poster_path: poster,
          backdrop_path: null,
          date: anime.aired?.from ?? (year ? `${year}-01-01` : ""),
          vote_average: anime.score ?? 0,
          episode,
          dub: isDub,
        }}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h1>

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
          </div>

          {anime.synopsis && (
            <p className="text-foreground/70 leading-relaxed line-clamp-3">
              {anime.synopsis}
            </p>
          )}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8">
        <AnimePlayer
          malId={anime.mal_id}
          episodeCount={anime.episodes ?? episodes.length}
          episodes={episodes}
          episode={episode}
          dub={isDub}
        />
      </div>
    </div>
  );
}
