import { apiRequest } from "./client";
import type {
  MobileBrowseResponse,
  MobileHomeResponse,
  MobileLocale,
  MobileMediaDetails,
  MobileMediaSummary,
  MobileMediaType,
  MobileSeasonResponse,
  SearchResponse,
} from "../types/api";

export type BrowseCategory =
  | "trending"
  | "popular"
  | "top-rated"
  | "now-playing"
  | "upcoming"
  | "airing-today"
  | "on-the-air";

export function getHome(locale: MobileLocale, signal?: AbortSignal) {
  return apiRequest<MobileHomeResponse>("/api/mobile/home", {
    query: { lang: locale },
    signal,
  });
}

export function browseMedia(
  type: MobileMediaType,
  category: BrowseCategory,
  page: number,
  locale: MobileLocale,
  signal?: AbortSignal,
) {
  return apiRequest<MobileBrowseResponse>("/api/mobile/browse", {
    query: { type, category, page, lang: locale },
    signal,
  });
}

export function getMediaDetails(
  type: MobileMediaType,
  id: number,
  locale: MobileLocale,
  signal?: AbortSignal,
) {
  return apiRequest<MobileMediaDetails>(`/api/mobile/media/${type}/${id}`, {
    query: { lang: locale },
    signal,
  });
}

export function getSeason(
  showId: number,
  season: number,
  locale: MobileLocale,
  signal?: AbortSignal,
) {
  return apiRequest<MobileSeasonResponse>(`/api/mobile/season/${showId}/${season}`, {
    query: { lang: locale },
    signal,
  });
}

export function searchMedia(
  query: string,
  page: number,
  locale: MobileLocale,
  signal?: AbortSignal,
) {
  return apiRequest<SearchResponse>("/api/search", {
    query: { q: query, page, lang: locale },
    signal,
  });
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** `/api/search` returns raw TMDB paths. Other mobile endpoints return full URLs. */
function tmdbImage(path: string | null | undefined, size: string): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function toSearchSummary(item: SearchResponse["results"][number]): MobileMediaSummary {
  return {
    id: item.id,
    mediaType: item.media_type,
    title: item.title ?? item.name ?? "",
    overview: item.overview ?? "",
    posterUrl: tmdbImage(item.poster_path, "w500"),
    backdropUrl: tmdbImage(item.backdrop_path, "w1280"),
    date: item.release_date ?? item.first_air_date ?? "",
    rating: item.vote_average ?? 0,
  };
}
