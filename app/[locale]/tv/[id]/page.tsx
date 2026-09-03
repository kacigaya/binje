import { notFound } from "next/navigation";
import WatchNowLink from "@/components/WatchNowLink";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Calendar, Tv, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@appica/ui-react/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import WatchlistButton from "@/components/WatchlistButton";
import StreamTechBadges from "@/components/StreamTechBadges";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";
import {
  getTVDetails,
  getTVCredits,
  getSimilarTV,
} from "@/lib/cached-tmdb";
import {
  getTVContentRating,
  tvToMedia,
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
  if (showId === null) return {};
  const show = await getTVDetails(showId, locale);
  const image = backdropUrl(show.backdrop_path, "w1280");
  return {
    title: show.name,
    description: show.overview,
    alternates: { canonical: `/${locale}/tv/${showId}` },
    openGraph: {
      type: "video.tv_show",
      title: show.name,
      description: show.overview,
      url: `/${locale}/tv/${showId}`,
      ...(image ? { images: [image] } : {}),
    },
  };
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

  const show = await getTVDetails(showId, locale);

  const backdrop = backdropUrl(show.backdrop_path, "w1280");
  const poster = posterUrl(show.poster_path, "w500");
  const contentRating = getTVContentRating(show);

  return (
    <div className="flex flex-col">
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
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/30" />
      </div>

      <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="relative w-50 sm:w-65 aspect-2/3 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
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

          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-balance"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {show.name}
            </h1>

            {show.tagline && (
              <p className="text-lg text-accent-red/80 italic">
                {show.tagline}
              </p>
            )}

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

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-2">
              <WatchNowLink
                href={localizedHref(locale, `/watch/tv/${show.id}`)}
                label={translate(locale, "Watch Now")}
                className={buttonVariants({
                  size: "lg",
                  className:
                    "w-full sm:w-auto rounded-full font-semibold gap-2 px-10 h-12 text-base cursor-pointer",
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

            <div className="mt-6">
              <Separator className="bg-white/10" />
            </div>

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
          </div>
        </div>

        {show.seasons.length > 0 && (
          <div className="mt-12">
            <h2
              className="text-xl font-bold mb-6"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {translate(locale, "Seasons")}
            </h2>
            <div
              tabIndex={0}
              role="group"
              aria-label={translate(locale, "Seasons")}
              className="flex gap-4 overflow-x-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50"
            >
              {show.seasons
                .filter((s) => s.season_number > 0)
                .map((season) => {
                  const sPoster = posterUrl(season.poster_path, "w300");
                  return (
                    <Link
                      key={season.id}
                      href={localizedHref(locale, `/watch/tv/${show.id}?s=${season.season_number}&e=1`)}
                      className="group shrink-0"
                    >
                      <div className="relative w-35 sm:w-40 overflow-hidden rounded-xl bg-card transition-transform duration-200 group-hover:scale-[1.04] group-hover:ring-1 group-hover:ring-white/25">
                        <div className="relative aspect-2/3 overflow-hidden rounded-xl">
                          <Image
                            src={sPoster}
                            alt={season.name}
                            fill
                            loading="lazy"
                            className="object-cover"
                            sizes="160px"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-sm font-semibold text-white leading-tight">
                              {season.name}
                            </p>
                            <p className="text-xs text-white/60 mt-0.5">
                              {season.episode_count} {translate(locale, "Episodes").toLowerCase()}
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

        <Suspense fallback={null}>
          <TVShowCast showId={showId} locale={locale} />
        </Suspense>

        <Suspense fallback={<div className="mt-12"><CarouselSkeleton /></div>}>
          <SimilarShows showId={showId} locale={locale} />
        </Suspense>
      </div>
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
    <div className="mt-12">
      <Carousel title={translate(locale, "Similar Shows")} items={similar.map(tvToMedia)} />
    </div>
  );
}
