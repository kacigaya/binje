import { notFound } from "next/navigation";
import WatchNowLink from "@/components/WatchNowLink";
import type { Metadata } from "next";
import Image from "next/image";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Calendar, Tv, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import WatchlistButton from "@/components/WatchlistButton";
import DetailHero from "@/components/DetailHero";
import SeasonEpisodes from "@/components/SeasonEpisodes";
import { Skeleton } from "@/components/ui/skeleton";
import StreamTechBadges from "@/components/StreamTechBadges";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";
import {
  getTVDetails,
  getTVCredits,
  getTVImages,
  getSeasonEpisodes,
  getSimilarTV,
} from "@/lib/cached-tmdb";
import {
  getTVContentRating,
  tvToMedia,
  pickLogo,
  posterUrl,
  backdropUrl,
  profileUrl,
  parseTmdbId,
} from "@/lib/tmdb";
import { formatRating, intlLocale, isLocale, localizedHref, pluralize, translate, type Locale } from "@/lib/i18n";
import TVShowLoading from "./loading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const showId = parseTmdbId(id);
  if (showId === null) return { title: translate(locale, "TV") };
  try {
    const show = await getTVDetails(showId, locale);
    const image = backdropUrl(show.backdrop_path, "w1280");
    const fallback = translate(
      locale,
      "Browse movies and TV shows with TMDB and Rotten Tomatoes ratings, then play them from third-party sources.",
    );
    const description = show.overview || fallback;
    return {
      title: show.name,
      description,
      alternates: { canonical: `/${locale}/tv/${showId}` },
      openGraph: {
        type: "video.tv_show",
        title: show.name,
        description,
        url: `/${locale}/tv/${showId}`,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: translate(locale, "TV") };
  }
}

export default async function TVShowPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <Suspense fallback={<TVShowLoading heading={translate(locale, "TV")} />}>
      <TVShowDetails params={params} />
    </Suspense>
  );
}

async function TVShowDetails({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const showId = parseTmdbId(id);
  if (showId === null) notFound();

  const [show, images] = await Promise.all([
    getTVDetails(showId, locale),
    getTVImages(showId, locale).catch(() => null),
  ]);

  const contentRating = getTVContentRating(show);
  const seasons = show.seasons
    .filter((season) => season.season_number > 0)
    .map(({ season_number, name, episode_count }) => ({ season_number, name, episode_count }));

  return (
    <DetailHero
      title={show.name}
      backdrop={backdropUrl(show.backdrop_path, "w1280")}
      poster={posterUrl(show.poster_path, "w500")}
      logo={images ? pickLogo(images.logos, locale) : null}
      tagline={show.tagline}
      details={
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground tabular-nums">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Image
                src="/tmdb.svg"
                alt="TMDB"
                width={37}
                height={16}
                className="h-4 w-auto shrink-0"
              />
              {formatRating(locale, show.vote_average) ?? translate(locale, "N/A")}
            </div>
            <RottenTomatoesRating imdbId={show.external_ids.imdb_id} />
            {contentRating && (
              <span className="rounded-md border border-white/15 px-1.5 text-xs font-semibold text-foreground/80">
                {contentRating}
              </span>
            )}
            <div className="flex items-center gap-1">
              <Layers aria-hidden="true" className="size-4" />
              {show.number_of_seasons} {pluralize(locale, show.number_of_seasons, "Season", "Seasons")}
            </div>
            <div className="flex items-center gap-1">
              <Tv aria-hidden="true" className="size-4" />
              {show.number_of_episodes} {pluralize(locale, show.number_of_episodes, "Episode", "Episodes")}
            </div>
            {show.first_air_date && (
              <div className="flex items-center gap-1">
                <Calendar aria-hidden="true" className="size-4" />
                {new Date(show.first_air_date).toLocaleDateString(intlLocale(locale), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
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

          <div className="flex flex-wrap gap-2">
            {show.genres.map((g) => (
              <Badge
                key={g.id}
                variant="outline"
                className="h-5 px-2 border-white/15 text-foreground/80 text-xs"
              >
                {g.name}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <WatchNowLink
              href={localizedHref(locale, `/watch/tv/${show.id}`)}
              label={translate(locale, "Watch Now")}
              media={{ type: "tv", id: show.id }}
              className={buttonClassName({
                size: "lg",
                className:
                  "w-full sm:w-auto rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-10 h-12 text-base cursor-pointer",
              })}
            />
            <WatchlistButton
              item={{
                type: "tv",
                id: show.id,
                title: show.name,
                poster_path: show.poster_path,
                backdrop_path: show.backdrop_path,
                date: show.first_air_date,
                vote_average: show.vote_average,
              }}
            />
          </div>

          <Separator className="bg-white/10" />

          <div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {translate(locale, "Overview")}
            </h2>
            <p className="text-foreground/70 leading-relaxed">
              {show.overview}
            </p>
          </div>

          {show.created_by.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">
                {translate(locale, "Created by")}
              </span>
              <p className="font-medium">
                {show.created_by.map((c) => c.name).join(", ")}
              </p>
            </div>
          )}

          {show.networks.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">{translate(locale, "Network")}</span>
              <p className="font-medium">
                {show.networks.map((n) => n.name).join(", ")}
              </p>
            </div>
          )}
        </>
      }
    >
      {seasons.length > 0 && (
        <Suspense fallback={<EpisodesSkeleton />}>
          <ShowEpisodes showId={show.id} seasons={seasons} locale={locale} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <TVShowCast showId={showId} locale={locale} />
      </Suspense>

      <Suspense fallback={<div className="mt-12 -mx-4 sm:-mx-6"><CarouselSkeleton /></div>}>
        <SimilarShows showId={showId} locale={locale} />
      </Suspense>
    </DetailHero>
  );
}

async function ShowEpisodes({
  showId,
  seasons,
  locale,
}: {
  showId: number;
  seasons: { season_number: number; name: string; episode_count: number }[];
  locale: Locale;
}) {
  const initialSeason = seasons[0].season_number;
  const episodes = await getSeasonEpisodes(showId, initialSeason, locale).catch(() => []);
  return (
    <SeasonEpisodes
      showId={showId}
      seasons={seasons}
      initialSeason={initialSeason}
      initialEpisodes={episodes}
    />
  );
}

function EpisodesSkeleton() {
  return (
    <div className="mt-12 space-y-4" aria-hidden="true">
      <Skeleton className="h-7 w-28" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl sm:h-24" />
      ))}
    </div>
  );
}

async function TVShowCast({ showId, locale }: { showId: number; locale: Locale }) {
  const credits = await getTVCredits(showId, locale);
  const topCast = credits.cast.slice(0, 12);
  if (topCast.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="mb-6 text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
        {translate(locale, "Cast")}
      </h2>
      <div
        tabIndex={0}
        role="group"
        aria-label={translate(locale, "Cast")}
        className="flex gap-4 overflow-x-auto pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50"
      >
        {topCast.map((person, index) => {
          const photo = profileUrl(person.profile_path);
          return (
            <div key={`${person.id}-${index}`} className="w-27.5 shrink-0 text-center">
              <div className="relative mx-auto mb-2 size-27.5 overflow-hidden rounded-full bg-muted">
                {photo ? (
                  <Image src={photo} alt={person.name} fill loading="lazy" className="object-cover" sizes="110px" />
                ) : (
                  <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                    {person.name.charAt(0)}
                  </div>
                )}
              </div>
              <p className="line-clamp-1 text-sm font-medium leading-tight">{person.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{person.character}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function SimilarShows({ showId, locale }: { showId: number; locale: Locale }) {
  const similar = await getSimilarTV(showId, locale);
  if (similar.length === 0) return null;

  return (
    // The carousel pads itself to the page gutter, so step out of this one.
    <div className="mt-12 -mx-4 sm:-mx-6">
      <Carousel title={translate(locale, "Similar Shows")} items={similar.map(tvToMedia)} />
    </div>
  );
}
