export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
  adult: boolean;
  original_language: string;
  original_title: string;
  video: boolean;
}

export interface MovieDetails extends Movie {
  budget: number;
  genres: Genre[];
  homepage: string;
  imdb_id: string;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  production_companies: ProductionCompany[];
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
}

export interface TVShowDetails extends TVShow {
  genres: Genre[];
  homepage: string;
  number_of_episodes: number;
  number_of_seasons: number;
  seasons: Season[];
  status: string;
  tagline: string;
  episode_run_time: number[];
  created_by: { id: number; name: string; profile_path: string | null }[];
  networks: { id: number; name: string; logo_path: string | null }[];
  production_companies: ProductionCompany[];
}

interface Season {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  episodes: Episode[];
}

interface Genre {
  id: number;
  name: string;
}

interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface MovieResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

export interface TVShowResponse {
  page: number;
  results: TVShow[];
  total_pages: number;
  total_results: number;
}

export interface TMDBImageAsset {
  aspect_ratio: number;
  file_path: string;
  height: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  width: number;
}

export interface MovieImagesResponse {
  id: number;
  backdrops: TMDBImageAsset[];
  logos: TMDBImageAsset[];
  posters: TMDBImageAsset[];
}

export interface TVImagesResponse {
  id: number;
  backdrops: TMDBImageAsset[];
  logos: TMDBImageAsset[];
  posters: TMDBImageAsset[];
}

/** Unified type for carousels, cards, hero — works for both movies and TV */
export interface MediaItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  date: string;
  vote_average: number;
  media_type: "movie" | "tv";
  logo_path?: string | null;
  logo_width?: number;
  logo_height?: number;
}

export interface MultiSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  profile_path?: string | null;
}

export interface MultiSearchResponse {
  page: number;
  results: MultiSearchResult[];
  total_pages: number;
  total_results: number;
}
