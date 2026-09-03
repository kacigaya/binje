import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { locale as getRootLocale } from "next/root-params";
import { connection } from "next/server";
import { Suspense } from "react";
import { Calendar, Layers, Tv } from "lucide-react";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";
import { Badge } from "@appica/ui-react/badge";
import {
  getTVDetails,
  getTVImages,
  getSeasonEpisodes,
} from "@/lib/cached-tmdb";
import {
  getTVContentRating,
  backdropUrl,
  logoUrl,
  pickLogo,
  parseTmdbId,
} from "@/lib/tmdb";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import ExpandableOverview from "@/components/ExpandableOverview";
import TVPlayer from "./TVPlayer";
import Link from "next/link";
import StreamTechBadges from "@/components/StreamTechBadges";
import { formatRating, isLocale, localizedHref, pluralize, translate, type Locale } from "@/lib/i18n";
import { WatchTVInfoLoading, WatchTVPlayerLoading } from "./loading";

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
  if (showId === null) return {};
  const show = await getTVDetails(showId, locale);
  const season = s ? parseInt(s, 10) : 1;
  const episode = e ? parseInt(e, 10) : 1;
  const title = `${show.name}: ${translate(locale, "Season")} ${season}, ${translate(locale, "Episode")} ${episode}`;
  const image = backdropUrl(show.backdrop_path, "w1280");
  return {
    title,
    description: show.overview,
    alternates: { canonical: `/${locale}/tv/${showId}` },
    openGraph: {
      type: "video.episode",
      title,
      description: show.overview,
      url: `/${locale}/watch/tv/${showId}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

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
    <div className="flex flex-col pt-20" data-testid="watch-tv-shell">
      <Suspense fallback={<WatchTVInfoLoading heading={translate(locale, "TV")} />}>
        <WatchTVInfo params={params} />
      </Suspense>
      <Suspense fallback={<WatchTVPlayerLoading />}>
        <WatchTVPlayer params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WatchTVInfo({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const showId = parseTmdbId(id);
  if (showId === null) notFound();
  const showPromise = getTVDetails(showId, locale);
  const [show, images] = await Promise.all([
    showPromise,
    getTVImages(showId, locale),
  ]);
  const logo = pickLogo(images.logos, locale);
  const showLogoUrl = logoUrl(logo?.file_path ?? null);
  const contentRating = getTVContentRating(show);

  return (
    <div
      className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4"
      data-testid="watch-tv-data"
    >
        <div className="space-y-4 mt-6">
          <Link
            href={localizedHref(locale, `/tv/${show.id}`)}
            className="inline-block"
          >
            {logo && showLogoUrl ? (
              <>
                {/* The logo replaces the title visually; the heading keeps
                    the page from rendering without an h1. */}
                <h1 className="sr-only">{show.name}</h1>
                <Image
                  src={showLogoUrl}
                  alt=""
                  aria-hidden="true"
                  width={logo.width}
                  height={logo.height}
                  className="h-auto max-h-24 w-auto max-w-xs object-contain sm:max-w-md"
                  priority
                />
              </>
            ) : (
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {show.name}
              </h1>
            )}
          </Link>

          <div className="flex flex-wrap gap-2">
            {show.genres.map((g) => (
              <Badge
                key={g.id}
                variant="outline"
                size="sm"
                className="border-border-strong text-foreground-muted"
              >
                {g.name}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground tabular-nums">
            <div className="flex items-center gap-1.5 text-accent-red font-semibold">
              <Image
                src="/tmdb.svg"
                alt=""
                width={37}
                height={16}
                aria-hidden="true"
                className="h-4 w-auto shrink-0"
              />
              {formatRating(locale, show.vote_average) ?? translate(locale, "N/A")}
            </div>
            <RottenTomatoesRating imdbId={show.external_ids.imdb_id} />
            {contentRating && (
              <div className="font-semibold text-accent-red">{contentRating}</div>
            )}
            <div className="flex items-center gap-1">
              <Layers className="size-4" />
              {show.number_of_seasons} {pluralize(locale, show.number_of_seasons, "Season", "Seasons")}
            </div>
            <div className="flex items-center gap-1">
              <Tv className="size-4" />
              {show.number_of_episodes} {pluralize(locale, show.number_of_episodes, "Episode", "Episodes")}
            </div>
            {show.first_air_date && (
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                {new Date(show.first_air_date).getFullYear()}
              </div>
            )}
            <StreamTechBadges
              type="tv"
              tmdbId={show.id}
              title={show.original_name}
              year={show.first_air_date.slice(0, 4)}
              imdbId={show.external_ids.imdb_id}
            />
          </div>

          <ExpandableOverview
            text={show.overview}
            className="text-foreground/70 leading-relaxed"
          />
        </div>
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

  const season = s ? parseInt(s, 10) : 1;
  const episode = e ? parseInt(e, 10) : 1;
  const show = await getTVDetails(showId, locale);
  const initialEpisodes = await getSeasonEpisodes(showId, season, locale).catch(
    () => [],
  );
  const seasons = show.seasons.filter((item) => item.season_number > 0);

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
          season,
          episode,
        }}
      />
      <div
        className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8"
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
        />
      </div>
    </>
  );
}
