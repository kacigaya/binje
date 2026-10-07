/**
 * URL state for the /movies and /tv-shows filters. Query values come straight
 * from the address bar, so every field is checked against an allowlist and
 * anything unexpected falls back to the default instead of reaching TMDB.
 */

export type BrowseType = "movie" | "tv";
export const SORT_KEYS = ["popular", "rating", "newest"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const DECADES = [2020, 2010, 2000, 1990, 1980, 1970] as const;
export type Decade = (typeof DECADES)[number];

// TMDB's discover endpoint stops at page 500; deep pages are rarely useful.
export const MAX_PAGE = 50;
// Keeps "top rated" from being led by titles with a handful of votes.
const MIN_RATING_VOTES = 300;
// "Newest" would otherwise surface placeholder entries nobody has rated.
const MIN_NEWEST_VOTES = 10;

export interface BrowseFilters {
  genre: number | null;
  sort: SortKey;
  decade: Decade | null;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | undefined): number | null {
  if (!value || !/^\d{1,6}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

export function parseBrowseFilters(
  params: RawParams,
  genreIds: ReadonlySet<number>,
): BrowseFilters {
  const genre = positiveInt(single(params.genre));
  const sort = single(params.sort);
  const decade = positiveInt(single(params.decade));
  const page = positiveInt(single(params.page)) ?? 1;

  return {
    genre: genre !== null && genreIds.has(genre) ? genre : null,
    sort: SORT_KEYS.find((key) => key === sort) ?? "popular",
    decade: DECADES.find((value) => value === decade) ?? null,
    page: Math.min(page, MAX_PAGE),
  };
}

export function isFiltered(filters: BrowseFilters): boolean {
  return (
    filters.genre !== null ||
    filters.decade !== null ||
    filters.sort !== "popular" ||
    filters.page > 1
  );
}

/**
 * Query string for `filters` with `patch` applied. Changing any filter other
 * than the page sends the viewer back to page one.
 */
export function browseQuery(
  filters: BrowseFilters,
  patch: Partial<BrowseFilters>,
): string {
  const next = { ...filters, ...patch };
  if (!("page" in patch)) next.page = 1;

  const params = new URLSearchParams();
  if (next.genre !== null) params.set("genre", String(next.genre));
  if (next.sort !== "popular") params.set("sort", next.sort);
  if (next.decade !== null) params.set("decade", String(next.decade));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** TMDB `/discover/{type}` path and query for `filters`. */
export function discoverEndpoint(
  type: BrowseType,
  filters: BrowseFilters,
  today: string,
): string {
  const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
  const params = new URLSearchParams({
    page: String(filters.page),
    include_adult: "false",
  });

  if (filters.sort === "popular") params.set("sort_by", "popularity.desc");
  if (filters.sort === "rating") {
    params.set("sort_by", "vote_average.desc");
    params.set("vote_count.gte", String(MIN_RATING_VOTES));
  }
  if (filters.sort === "newest") {
    params.set("sort_by", `${dateField}.desc`);
    // Unreleased titles would otherwise fill the first pages.
    params.set(`${dateField}.lte`, today);
    params.set("vote_count.gte", String(MIN_NEWEST_VOTES));
  }
  if (filters.genre !== null) params.set("with_genres", String(filters.genre));
  if (filters.decade !== null) {
    params.set(`${dateField}.gte`, `${filters.decade}-01-01`);
    const end = `${filters.decade + 9}-12-31`;
    const existing = params.get(`${dateField}.lte`);
    params.set(`${dateField}.lte`, existing && existing < end ? existing : end);
  }

  return `/discover/${type}?${params.toString()}`;
}
