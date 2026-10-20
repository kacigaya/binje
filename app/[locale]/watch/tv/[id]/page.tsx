import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { locale as getRootLocale } from "next/root-params";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { getTVDetails, getTVImages, getSeasonEpisodes } from "@/lib/cached-tmdb";
import { backdropUrl, logoUrl, parseTmdbId, pickLogo } from "@/lib/tmdb";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import TVPlayer from "./TVPlayer";
import Link from "next/link";
import {
  isLocale,
  localizedHref,
  translate,
  type Locale,
} from "@/lib/i18n";
import { WatchTVPlayerLoading } from "./loading";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const { s, e } = await searchParams;
  const showId = parseTmdbId(id);
  if (showId === null) return { title: translate(locale, "TV") };
  try {
    const show = await getTVDetails(showId, locale);
    const { season, episode } = parseEpisodeParams(s, e);
    const title = `${show.name}: ${translate(locale, "Season")} ${season}, ${translate(locale, "Episode")} ${episode}`;
    const image = backdropUrl(show.backdrop_path, "w1280");
    const fallback = translate(
      locale,
      "Browse movies and TV shows with TMDB and Rotten Tomatoes ratings, then play them from third-party sources.",
    );
    const description = show.overview || fallback;
    const canonical = `/${locale}/tv/${showId}`;
    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: false },
      openGraph: {
        type: "video.episode",
        title,
        description,
        url: canonical,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: translate(locale, "TV") };
  }
}

function parseEpisodeParams(s?: string, e?: string) {
  return {
    season: s ? parseInt(s, 10) : 1,
    episode: e ? parseInt(e, 10) : 1,
  };
}

// Memoize per request so the info and player Suspense branches share one show-details fetch.
const getCachedTVDetails = cache(getTVDetails);

export default async function WatchTVPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <div className="flex flex-col pt-24" data-testid="watch-tv-shell">
      <Suspense fallback={<WatchTVPlayerLoading heading={translate(locale, "TV")} />}>
        <WatchTVPlayer params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WatchTVPlayer({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
  await connection();
  const [{ locale, id }, { s, e }] = await Promise.all([params, searchParams]);
  const showId = parseTmdbId(id);
  if (showId === null) notFound();

  const { season, episode } = parseEpisodeParams(s, e);
  const [show, initialEpisodes, images] = await Promise.all([
    getCachedTVDetails(showId, locale),
    getSeasonEpisodes(showId, season, locale).catch(() => []),
    getTVImages(showId, locale).catch(() => null),
  ]);
  const logo = pickLogo(images?.logos ?? [], locale);
  const showLogoUrl = logoUrl(logo?.file_path ?? null);
  const seasons = show.seasons.filter((item) => item.season_number > 0);
  const currentEpisode = initialEpisodes.find(
    (item) => item.episode_number === episode,
  );

  return (
    <>
      <PlayHistoryRecorder
        item={{
          type: "tv",
          id: show.id,
          title: show.name,
          poster_path: show.poster_path,
          backdrop_path: show.backdrop_path,
          date: show.first_air_date,
          vote_average: show.vote_average,
          logoPath: logo?.file_path ?? null,
          season,
          episode,
          episodeName: currentEpisode?.name,
          episodeStillPath: currentEpisode?.still_path,
        }}
      />
      <div
        className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-12"
        data-testid="watch-tv-player"
      >
        <TVPlayer
          showId={show.id}
          title={show.original_name}
          year={show.first_air_date.slice(0, 4)}
          imdbId={show.external_ids.imdb_id}
          season={season}
          episode={episode}
          seasons={seasons.map((item) => ({
            season_number: item.season_number,
            name: item.name,
            episode_count: item.episode_count,
          }))}
          initialEpisodes={initialEpisodes}
          poster={backdropUrl(show.backdrop_path, "w1280")}
          header={
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Link
                href={localizedHref(locale, `/tv/${show.id}`)}
                className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
              >
                {logo && showLogoUrl ? (
                  <Image
                    src={showLogoUrl}
                    alt={show.name}
                    width={logo.width}
                    height={logo.height}
                    className="h-auto max-h-14 w-auto max-w-60 object-contain object-left sm:max-h-16 sm:max-w-xs"
                  />
                ) : (
                  show.name
                )}
              </Link>
            </h1>
          }
        />
      </div>
    </>
  );
}
