import { notFound } from "next/navigation";
import WatchNowLink from "@/components/WatchNowLink";
import type { Metadata } from "next";
import Image from "next/image";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import CastRow from "@/components/CastRow";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import WatchlistButton from "@/components/WatchlistButton";
import DetailHero from "@/components/DetailHero";
import StreamTechBadges from "@/components/StreamTechBadges";
import RottenTomatoesRating from "@/components/RottenTomatoesRating.client";
import {
  getMovieDetails,
  getMovieCredits,
  getMovieImages,
  getSimilarMovies,
} from "@/lib/cached-tmdb";
import {
  getMovieContentRating,
  movieToMedia,
  pickLogo,
  posterUrl,
  backdropUrl,
  profileUrl,
  parseTmdbId,
} from "@/lib/tmdb";
import { formatRating, intlLocale, isLocale, localizedHref, translate, type Locale } from "@/lib/i18n";
import MovieLoading from "./loading";

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
    return {
      title: movie.title,
      description,
      alternates: { canonical: `/${locale}/movie/${movieId}` },
      openGraph: {
        type: "video.movie",
        title: movie.title,
        description,
        url: `/${locale}/movie/${movieId}`,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: translate(locale, "Movie") };
  }
}

export default async function MoviePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

  return (
    <Suspense fallback={<MovieLoading heading={translate(locale, "Movie")} />}>
      <MovieDetails params={params} />
    </Suspense>
  );
}

async function MovieDetails({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const movieId = parseTmdbId(id);
  if (movieId === null) notFound();

  const [movie, images] = await Promise.all([
    getMovieDetails(movieId, locale),
    getMovieImages(movieId, locale).catch(() => null),
  ]);

  const contentRating = getMovieContentRating(movie);

  return (
    <DetailHero
      title={movie.title}
      backdrop={backdropUrl(movie.backdrop_path, "w1280")}
      poster={posterUrl(movie.poster_path, "w500")}
      logo={images ? pickLogo(images.logos, locale) : null}
      tagline={movie.tagline}
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
              {formatRating(locale, movie.vote_average) ?? translate(locale, "N/A")}
            </div>
            <RottenTomatoesRating imdbId={movie.imdb_id} />
            {contentRating && (
              <span className="rounded-md border border-white/15 px-1.5 text-xs font-semibold text-foreground/80">
                {contentRating}
              </span>
            )}
            {movie.runtime > 0 && (
              <div className="flex items-center gap-1">
                <Clock aria-hidden="true" className="size-4" />
                {Math.floor(movie.runtime / 60)}&nbsp;h {movie.runtime % 60}&nbsp;m
              </div>
            )}
            {movie.release_date && (
              <div className="flex items-center gap-1">
                <Calendar aria-hidden="true" className="size-4" />
                {new Date(movie.release_date).toLocaleDateString(intlLocale(locale), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
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

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <WatchNowLink
              href={localizedHref(locale, `/watch/${movie.id}`)}
              label={translate(locale, "Watch Now")}
              media={{ type: "movie", id: movie.id }}
              className={buttonClassName({
                size: "lg",
                className:
                  "w-full sm:w-auto rounded-full bg-accent-red text-white font-semibold hover:bg-accent-red/90 gap-2 px-10 h-12 text-base cursor-pointer",
              })}
            />
            <WatchlistButton
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
              {movie.overview}
            </p>
          </div>

          <Suspense fallback={null}>
            <MovieDirector movieId={movieId} locale={locale} />
          </Suspense>
        </>
      }
    >
      <Suspense fallback={null}>
        <MovieCast movieId={movieId} locale={locale} />
      </Suspense>

      <Suspense fallback={<div className="mt-12 -mx-4 sm:-mx-6"><CarouselSkeleton /></div>}>
        <SimilarMovies movieId={movieId} locale={locale} />
      </Suspense>
    </DetailHero>
  );
}

async function MovieDirector({ movieId, locale }: { movieId: number; locale: Locale }) {
  const credits = await getMovieCredits(movieId, locale);
  const director = credits.crew.find((person) => person.job === "Director");
  if (!director) return null;

  return (
    <div>
      <span className="text-sm text-muted-foreground">
        {translate(locale, "Director")}
      </span>
      <p className="font-medium">{director.name}</p>
    </div>
  );
}

async function MovieCast({ movieId, locale }: { movieId: number; locale: Locale }) {
  const credits = await getMovieCredits(movieId, locale);
  const topCast = credits.cast.slice(0, 12);
  if (topCast.length === 0) return null;

  return (
    <div className="mt-12">
      <h2
        className="mb-6 text-xl font-bold"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {translate(locale, "Cast")}
      </h2>
      <CastRow
        label={translate(locale, "Cast")}
        cast={topCast.map((person, index) => ({
          key: `${person.id}-${index}`,
          name: person.name,
          character: person.character,
          photo: profileUrl(person.profile_path),
        }))}
      />
    </div>
  );
}

async function SimilarMovies({ movieId, locale }: { movieId: number; locale: Locale }) {
  const similar = await getSimilarMovies(movieId, locale);
  if (similar.length === 0) return null;

  return (
    // The carousel pads itself to the page gutter, so step out of this one.
    <div className="mt-12 -mx-4 sm:-mx-6">
      <Carousel title={translate(locale, "Similar Movies")} items={similar.map(movieToMedia)} />
    </div>
  );
}
