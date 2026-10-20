import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { locale as getRootLocale } from "next/root-params";
import { cache, Suspense } from "react";
import { Calendar, Clock, Info } from "lucide-react";
import StreamTechBadges from "@/components/StreamTechBadges";
import Player from "@/components/Player";
import PlayHistoryRecorder from "@/components/PlayHistoryRecorder";
import { getMovieDetails } from "@/lib/cached-tmdb";
import { backdropUrl, parseTmdbId } from "@/lib/tmdb";
import { isLocale, localizedHref, translate, type Locale } from "@/lib/i18n";
import { WatchInfoLoading, WatchPlayerLoading } from "./loading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) return { title: translate(locale, "Movie") };
  try {
    const movie = await getMovieDetails(movieId, locale);
    const image = backdropUrl(movie.backdrop_path, "w1280");
    const fallback = translate(
      locale,
      "Browse movies and TV shows with TMDB and Rotten Tomatoes ratings, then play them from third-party sources.",
    );
    const description = movie.overview || fallback;
    const canonical = `/${locale}/movie/${movieId}`;
    return {
      title: movie.title,
      description,
      alternates: { canonical },
      robots: { index: false },
      openGraph: {
        type: "video.movie",
        title: movie.title,
        description,
        url: canonical,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: translate(locale, "Movie") };
  }
}

// Memoize per request so the info and player Suspense branches share one details fetch.
const getCachedMovieDetails = cache(getMovieDetails);

export default async function WatchPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <div className="flex flex-col pt-24" data-testid="watch-movie-shell">
      <Suspense fallback={<WatchPlayerLoading />}>
        <WatchMoviePlayer params={params} />
      </Suspense>
      <Suspense fallback={<WatchInfoLoading heading={translate(locale, "Movie")} />}>
        <WatchMovieInfo params={params} />
      </Suspense>
    </div>
  );
}

/** The details page covers ratings, genres, and the synopsis; this block stays minimal. */
async function WatchMovieInfo({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) notFound();
  const movie = await getCachedMovieDetails(movieId, locale);

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

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-2 pb-12 space-y-3">
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {movie.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground tabular-nums">
          {movie.release_date && (
            <div className="flex items-center gap-1">
              <Calendar aria-hidden="true" className="size-4" />
              {new Date(movie.release_date).getFullYear()}
            </div>
          )}
          {movie.runtime > 0 && (
            <div className="flex items-center gap-1">
              <Clock aria-hidden="true" className="size-4" />
              {Math.floor(movie.runtime / 60)}&nbsp;h {movie.runtime % 60}&nbsp;m
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

        <Link
          href={localizedHref(locale, `/movie/${movie.id}`)}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          <Info aria-hidden="true" className="size-4" />
          {translate(locale, "Details")}
        </Link>
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
  const movie = await getCachedMovieDetails(movieId, locale);

  return (
    <div
      className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-6"
      data-testid="watch-movie-player"
    >
      <Player
        tmdbId={movie.id}
        title={movie.original_title}
        year={movie.release_date.slice(0, 4)}
        imdbId={movie.imdb_id}
        type="movie"
        poster={backdropUrl(movie.backdrop_path, "w1280")}
      />
    </div>
  );
}
