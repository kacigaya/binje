// MyAnimeList data via the Jikan API (https://docs.api.jikan.moe).

export interface JikanImage {
  jpg?: { image_url?: string; large_image_url?: string };
  webp?: { image_url?: string; large_image_url?: string };
}

export interface JikanGenre {
  mal_id: number;
  name: string;
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  synopsis: string | null;
  images: JikanImage;
  episodes: number | null;
  type: string | null;
  status: string | null;
  score: number | null;
  year: number | null;
  rating: string | null;
  genres: JikanGenre[];
  studios?: JikanGenre[];
  aired?: { from: string | null };
  trailer?: { youtube_id?: string | null };
}

export interface JikanEpisode {
  mal_id: number;
  title: string | null;
  title_japanese?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
}

export interface JikanListResponse<T> {
  data: T[];
  pagination?: {
    has_next_page: boolean;
    last_visible_page: number;
  };
}

export interface JikanItemResponse<T> {
  data: T;
}
