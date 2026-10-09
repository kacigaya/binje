import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import BrowseFilterSelect from "@/components/BrowseFilterSelect";
import MediaCard from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import {
  browseQuery,
  DECADES,
  discoverEndpoint,
  isFiltered,
  MAX_PAGE,
  parseBrowseFilters,
  SORT_KEYS,
  type BrowseFilters,
  type BrowseType,
  type Decade,
  type SortKey,
} from "@/lib/browse";
import { discoverMovies, discoverTV, getGenres } from "@/lib/cached-tmdb";
import { localizedHref, translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { movieToMedia, tvToMedia } from "@/lib/tmdb";
import type { Genre } from "@/types/tmdb";

type RawParams = Record<string, string | string[] | undefined>;

const SORT_LABELS: Record<SortKey, TranslationKey> = {
  popular: "Popular",
  rating: "Top rated",
  newest: "Newest",
};

function decadeLabel(locale: Locale, decade: Decade) {
  return locale === "fr" ? `Années ${decade}` : `${decade}s`;
}

/**
 * Filters and results for /movies and /tv-shows. Without filters the page
 * keeps its curated rails (`rails`); any filter swaps them for a TMDB
 * discover grid. All state lives in the query string, so results are
 * shareable; the dropdowns navigate once hydrated.
 */
export default async function BrowseView({
  type,
  locale,
  searchParams,
  rails,
}: {
  type: BrowseType;
  locale: Locale;
  searchParams: Promise<RawParams>;
  rails: ReactNode;
}) {
  const [params, genres] = await Promise.all([
    searchParams,
    getGenres(type, locale).catch((): Genre[] => []),
  ]);
  const filters = parseBrowseFilters(params, new Set(genres.map((g) => g.id)));
  const basePath = localizedHref(locale, type === "movie" ? "/movies" : "/tv-shows");

  return (
    <>
      <FilterBar
        locale={locale}
        basePath={basePath}
        filters={filters}
        genres={genres}
      />
      {isFiltered(filters) ? (
        <DiscoverResults
          type={type}
          locale={locale}
          basePath={basePath}
          filters={filters}
        />
      ) : (
        rails
      )}
    </>
  );
}

function FilterBar({
  locale,
  basePath,
  filters,
  genres,
}: {
  locale: Locale;
  basePath: string;
  filters: BrowseFilters;
  genres: Genre[];
}) {
  const t = (key: TranslationKey) => translate(locale, key);
  const href = (patch: Partial<BrowseFilters>) => `${basePath}${browseQuery(filters, patch)}`;
  // The current filters map to the same href in every dropdown.
  const current = href({});

  return (
    <nav aria-label={t("Filters")} className="flex flex-wrap items-center gap-2 px-4 sm:px-6">
      {genres.length > 0 && (
        <BrowseFilterSelect
          label={t("Genre")}
          value={current}
          active={filters.genre !== null}
          items={[
            { value: href({ genre: null }), label: t("All") },
            ...genres.map((genre) => ({ value: href({ genre: genre.id }), label: genre.name })),
          ]}
        />
      )}
      <BrowseFilterSelect
        label={t("Sort by")}
        value={current}
        active={filters.sort !== "popular"}
        items={SORT_KEYS.map((key) => ({ value: href({ sort: key }), label: t(SORT_LABELS[key]) }))}
      />
      <BrowseFilterSelect
        label={t("Decade")}
        value={current}
        active={filters.decade !== null}
        items={[
          { value: href({ decade: null }), label: t("Any") },
          ...DECADES.map((decade) => ({
            value: href({ decade }),
            label: decadeLabel(locale, decade),
          })),
        ]}
      />
      {isFiltered(filters) && (
        <Link
          href={basePath}
          scroll={false}
          className="ml-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          {t("Clear filters")}
        </Link>
      )}
    </nav>
  );
}

async function DiscoverResults({
  type,
  locale,
  basePath,
  filters,
}: {
  type: BrowseType;
  locale: Locale;
  basePath: string;
  filters: BrowseFilters;
}) {
  const t = (key: TranslationKey) => translate(locale, key);
  // "Newest" stops at today's date, which must be read per request.
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const endpoint = discoverEndpoint(type, filters, today);
  // `null` marks a failed request, so an outage never renders as an empty filter.
  const data =
    type === "movie"
      ? await discoverMovies(endpoint, locale)
          .then((page) => ({ ...page, results: page.results.map(movieToMedia) }))
          .catch(() => null)
      : await discoverTV(endpoint, locale)
          .then((page) => ({ ...page, results: page.results.map(tvToMedia) }))
          .catch(() => null);

  const query = browseQuery(filters, { page: filters.page });
  if (!data) {
    return (
      <div role="alert" className="space-y-3 px-4 sm:px-6">
        <p className="font-semibold">{t("Couldn’t load titles")}</p>
        <p className="text-muted-foreground">
          {t("The catalogue service did not respond. This is usually temporary.")}
        </p>
        {/* A full reload: a client navigation to the same URL can reuse the failed render. */}
        <a
          href={`${basePath}${query}`}
          className="inline-block rounded-full border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          {t("Try again")}
        </a>
      </div>
    );
  }

  const { results, totalPages } = data;
  const lastPage = Math.min(totalPages, MAX_PAGE);

  if (results.length === 0) {
    return (
      <div className="space-y-3 px-4 sm:px-6">
        <p className="text-muted-foreground">{t("No titles match these filters.")}</p>
        {/* A hand-edited or stale page number can overshoot the last page. */}
        {filters.page > 1 ? (
          <Link
            href={`${basePath}${browseQuery(filters, { page: 1 })}`}
            className="inline-block rounded-full border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Page")} 1
          </Link>
        ) : (
          <Link
            href={basePath}
            className="inline-block rounded-full border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Clear filters")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <section aria-label={t("Results")} className="space-y-8 px-4 sm:px-6">
      {/* TMDB pages hold 20 titles: 2, 4 and 5 columns divide that evenly, so a
          full page never ends on a short row (6 columns left 2 orphans). */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
        {results.map((item, i) => (
          <MediaCard
            key={`${item.media_type}-${item.id}`}
            item={item}
            eager={i < 5}
            className="w-full min-w-0"
          />
        ))}
      </div>

      {lastPage > 1 && (
        <nav
          aria-label={t("Page")}
          className="flex items-center justify-center gap-3 text-sm"
        >
          {filters.page > 1 ? (
            <Link
              href={`${basePath}${browseQuery(filters, { page: filters.page - 1 })}`}
              className="rounded-full border border-white/15 px-4 py-2 font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
            >
              {t("Previous")}
            </Link>
          ) : null}
          <span className="text-muted-foreground tabular-nums">
            {t("Page")} {filters.page} / {lastPage}
          </span>
          {filters.page < lastPage ? (
            <Link
              href={`${basePath}${browseQuery(filters, { page: filters.page + 1 })}`}
              className="rounded-full border border-white/15 px-4 py-2 font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
            >
              {t("Next")}
            </Link>
          ) : null}
        </nav>
      )}
    </section>
  );
}

/** Suspense fallback while the query string and genre list resolve. */
export function BrowseViewSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden="true">
      <div className="flex gap-2 px-4 sm:px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36 shrink-0 rounded-full" />
        ))}
      </div>
      <CarouselSkeleton />
    </div>
  );
}
