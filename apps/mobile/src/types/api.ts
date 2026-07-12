export type {
  MobileApiErrorResponse,
  MobileBrowseResponse,
  MobileEpisode,
  MobileGenre,
  MobileHomeResponse,
  MobileLocale,
  MobileMediaDetails,
  MobileMediaSummary,
  MobileMediaType,
  MobilePerson,
  MobileSeason,
  MobileSeasonResponse,
  MobileStreamMetadata,
} from "../../../../types/mobile-api";

export type SearchResponse = {
  results: Array<{
    id: number;
    media_type: "movie" | "tv";
    title?: string;
    name?: string;
    overview?: string;
    poster_path: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
  }>;
  page: number;
  totalPages: number;
};

export type StreamResponse = {
  url: string;
  tracks?: Array<{ file: string; label?: string }>;
  sources?: Array<{ file: string; height: number }>;
};
