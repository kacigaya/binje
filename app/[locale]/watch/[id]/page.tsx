import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Clock, Calendar } from "lucide-react";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";
import StreamTechBadges from "@/components/StreamTechBadges";
import { Badge } from "@/components/ui/badge";
import Player from "@/components/Player";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import ExpandableOverview from "@/components/ExpandableOverview";
import {
  getMovieDetails,
  getMovieImages,
} from "@/lib/cached-tmdb";
import {
  getMovieContentRating,
  backdropUrl,
  logoUrl,
  pickLogo,
  parseTmdbId,
} from "@/lib/tmdb";
import { formatRating, isLocale, localizedHref, translate, type Locale } from "@/lib/i18n";
import { WatchInfoLoading, WatchPlayerLoading } from "./loading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) return {};
  const movie = await getMovieDetails(movieId, locale);
  const image = backdropUrl(movie.backdrop_path, "w1280");
  return {
    title: movie.title,
    description: movie.overview,
    alternates: { canonical: `/${locale}/movie/${movieId}` },
    openGraph: {
      type: "video.movie",
      title: movie.title,
      description: movie.overview,
      url: `/${locale}/watch/${movieId}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <div className="flex flex-col pt-20" data-testid="watch-movie-shell">
      <Suspense fallback={<WatchInfoLoading heading={translate(locale, "Movie")} />}>
        <WatchMovieInfo params={params} />
      </Suspense>
      <Suspense fallback={<WatchPlayerLoading />}>
        <WatchMoviePlayer params={params} />
      </Suspense>
    </div>
  );
}

async function WatchMovieInfo({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) notFound();
  const moviePromise = getMovieDetails(movieId, locale);
  const [movie, images] = await Promise.all([
    moviePromise,
    getMovieImages(movieId, locale),
  ]);
  const logo = pickLogo(images.logos, locale);
  const movieLogoUrl = logoUrl(logo?.file_path ?? null);
  const contentRating = getMovieContentRating(movie);

  return (
    <>
      <PlayHistoryRecorder
        item={{
          type: "movie",
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          date: movie.release_date,
          vote_average: movie.vote_average,
        }}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          <Link
            href={localizedHref(locale, `/movie/${movie.id}`)}
            className="inline-block"
          >
            {logo && movieLogoUrl ? (
              <>
                {/* The logo replaces the title visually; the heading keeps
                    the page from rendering without an h1. */}
                <h1 className="sr-only">{movie.title}</h1>
                <Image
                  src={movieLogoUrl}
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
                {movie.title}
              </h1>
            )}
          </Link>

          <div className="flex flex-wrap gap-2">
            {movie.genres.map((g) => (
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
              {formatRating(locale, movie.vote_average) ?? translate(locale, "N/A")}
            </div>
            <RottenTomatoesRating imdbId={movie.imdb_id} />
            {contentRating && (
              <div className="font-semibold text-accent-red">{contentRating}</div>
            )}
            {movie.runtime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="size-4" />
                {Math.floor(movie.runtime / 60)}&nbsp;h {movie.runtime % 60}&nbsp;m
              </div>
            )}
            {movie.release_date && (
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                {new Date(movie.release_date).getFullYear()}
              </div>
            )}
            <StreamTechBadges
              type="movie"
              tmdbId={movie.id}
              title={movie.original_title}
              year={movie.release_date.slice(0, 4)}
              imdbId={movie.imdb_id}
            />
          </div>

          <ExpandableOverview
            text={movie.overview}
            className="text-foreground/70 leading-relaxed"
          />
        </div>
      </div>

    </>
  );
}

async function WatchMoviePlayer({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) notFound();
  const movie = await getMovieDetails(movieId, locale);

  return (
    <div
      className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8"
      data-testid="watch-movie-player"
    >
      <Player
        tmdbId={movie.id}
        title={movie.original_title}
        year={movie.release_date.slice(0, 4)}
        imdbId={movie.imdb_id}
        type="movie"
      />
    </div>
  );
}
