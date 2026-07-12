import { apiRequest } from "./client";
import type {
  MobileBrowseResponse,
  MobileHomeResponse,
  MobileLocale,
  MobileMediaDetails,
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
