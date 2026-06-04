import { Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import {
  ANIME_GENRES,
  animeToMedia,
  getAiringAnime,
  getAnimeByGenre,
  getSeasonalAnime,
  getTopAnime,
  getUpcomingAnime,
} from "@/lib/jikan";
import type { JikanAnime } from "@/types/anime";

export const revalidate = 3600;

// Jikan rate-limits aggressively, so requests run in small sequential batches
// instead of one large parallel burst. A failed section degrades to empty so
// one rate-limited call can't take down the whole page.
async function batch(
  tasks: (() => Promise<JikanAnime[]>)[],
): Promise<JikanAnime[][]> {
  const results: JikanAnime[][] = [];
  for (const task of tasks) {
    results.push(await task().catch(() => []));
  }
  return results;
}

export default async function AnimePage() {
  const [popular, airing, seasonal, upcoming] = await batch([
    getTopAnime,
    getAiringAnime,
    getSeasonalAnime,
    getUpcomingAnime,
  ]);

  const [action, adventure, comedy, drama, fantasy, romance, supernatural] =
    await batch([
      () => getAnimeByGenre(ANIME_GENRES.action),
      () => getAnimeByGenre(ANIME_GENRES.adventure),
      () => getAnimeByGenre(ANIME_GENRES.comedy),
      () => getAnimeByGenre(ANIME_GENRES.drama),
      () => getAnimeByGenre(ANIME_GENRES.fantasy),
      () => getAnimeByGenre(ANIME_GENRES.romance),
      () => getAnimeByGenre(ANIME_GENRES.supernatural),
    ]);

  const sections: { title: string; items: JikanAnime[]; priority?: boolean }[] =
    [
      { title: "Most Popular", items: popular, priority: true },
      { title: "Airing Now", items: airing },
      { title: "This Season", items: seasonal },
      { title: "Upcoming", items: upcoming },
      { title: "Action", items: action },
      { title: "Adventure", items: adventure },
      { title: "Comedy", items: comedy },
      { title: "Drama", items: drama },
      { title: "Fantasy", items: fantasy },
      { title: "Romance", items: romance },
      { title: "Supernatural", items: supernatural },
    ].filter((section) => section.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Anime
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      {sections.map((section, i) =>
        i === 0 ? (
          <Carousel
            key={section.title}
            title={section.title}
            items={section.items.map(animeToMedia)}
            priority
          />
        ) : (
          <LazyCarousel
            key={section.title}
            title={section.title}
            items={section.items.map(animeToMedia)}
          />
        ),
      )}
    </div>
  );
}
