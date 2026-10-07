import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";
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
 * discover grid. All state lives in the query string and every control is a
 * plain link, so results are shareable and work before hydration.
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

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-white/15 text-foreground/80 hover:bg-white/10",
      )}
    >
      {children}
    </Link>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-20 shrink-0 pt-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {/* One scrollable line on phones; wraps once there is room. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {children}
      </div>
    </div>
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

  return (
    <nav aria-label={t("Filters")} className="space-y-3 px-4 sm:px-6">
      {genres.length > 0 && (
        <FilterRow label={t("Genre")}>
          <FilterChip href={href({ genre: null })} active={filters.genre === null}>
            {t("All")}
          </FilterChip>
          {genres.map((genre) => (
            <FilterChip
              key={genre.id}
              href={href({ genre: genre.id })}
              active={filters.genre === genre.id}
            >
              {genre.name}
            </FilterChip>
          ))}
        </FilterRow>
      )}
      <FilterRow label={t("Sort by")}>
        {SORT_KEYS.map((key) => (
          <FilterChip key={key} href={href({ sort: key })} active={filters.sort === key}>
            {t(SORT_LABELS[key])}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label={t("Decade")}>
        <FilterChip href={href({ decade: null })} active={filters.decade === null}>
          {t("Any")}
        </FilterChip>
        {DECADES.map((decade) => (
          <FilterChip
            key={decade}
            href={href({ decade })}
            active={filters.decade === decade}
          >
            {decadeLabel(locale, decade)}
          </FilterChip>
        ))}
      </FilterRow>
      {isFiltered(filters) && (
        <Link
          href={basePath}
          scroll={false}
          className="inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
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
  const { results, totalPages } =
    type === "movie"
      ? await discoverMovies(endpoint, locale)
          .then((data) => ({ ...data, results: data.results.map(movieToMedia) }))
          .catch(() => ({ results: [], totalPages: 0 }))
      : await discoverTV(endpoint, locale)
          .then((data) => ({ ...data, results: data.results.map(tvToMedia) }))
          .catch(() => ({ results: [], totalPages: 0 }));
  const lastPage = Math.min(totalPages, MAX_PAGE);

  if (results.length === 0) {
    return (
      <div className="space-y-3 px-4 sm:px-6">
        <p className="text-muted-foreground">{t("No results found")}</p>
        {/* A hand-edited or stale page number can overshoot the last page. */}
        {filters.page > 1 && (
          <Link
            href={`${basePath}${browseQuery(filters, { page: 1 })}`}
            className="inline-block rounded-full border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Page")} 1
          </Link>
        )}
      </div>
    );
  }

  return (
    <section aria-label={t("Results")} className="space-y-8 px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {results.map((item, i) => (
          <MediaCard
            key={`${item.media_type}-${item.id}`}
            item={item}
            eager={i < 6}
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
      <div className="space-y-3 px-4 sm:px-6">
        {Array.from({ length: 3 }).map((_, row) => (
          <div key={row} className="flex gap-2 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
            ))}
          </div>
        ))}
      </div>
      <CarouselSkeleton />
    </div>
  );
}
