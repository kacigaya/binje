export type MobileLocale = "en" | "fr";
export type MobileMediaType = "movie" | "tv";

export interface MobileMediaSummary {
  id: number;
  mediaType: MobileMediaType;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  date: string;
  rating: number;
}

export interface MobileHomeResponse {
  featured: MobileMediaSummary[];
  trendingMovies: MobileMediaSummary[];
  trendingTV: MobileMediaSummary[];
}

export interface MobileBrowseResponse {
  page: number;
  items: MobileMediaSummary[];
}

export interface MobileGenre { id: number; name: string }
export interface MobilePerson {
  id: number;
  name: string;
  role: string;
  profileUrl: string | null;
}
export interface MobileSeason {
  id: number;
  name: string;
  overview: string;
  posterUrl: string | null;
  seasonNumber: number;
  episodeCount: number;
  airDate: string;
}
export interface MobileStreamMetadata {
  mediaType: MobileMediaType;
  tmdbId: number;
  originalTitle: string;
  year: string;
  imdbId: string | null;
}

export interface MobileMediaDetails extends MobileMediaSummary {
  tagline: string;
  genres: MobileGenre[];
  cast: MobilePerson[];
  creators: MobilePerson[];
  runtime: number | null;
  contentRating: string | null;
  imdbId: string | null;
  rottenTomatoesScore: number | null;
  seasons: MobileSeason[];
  related: MobileMediaSummary[];
  stream: MobileStreamMetadata;
}

export interface MobileEpisode {
  id: number;
  name: string;
  overview: string;
  episodeNumber: number;
  seasonNumber: number;
  stillUrl: string | null;
  airDate: string | null;
  runtime: number | null;
  rating: number;
}
export interface MobileSeasonResponse {
  showId: number;
  seasonNumber: number;
  episodes: MobileEpisode[];
}

export interface MobileApiErrorResponse {
  error: { code: "INVALID_REQUEST" | "NOT_FOUND" | "UPSTREAM_ERROR"; message: string };
}
