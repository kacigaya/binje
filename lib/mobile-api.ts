import type { Credits, Episode, Movie, MovieDetails, TVShow, TVShowDetails } from "@/types/tmdb";
import type { MobileEpisode, MobileMediaDetails, MobileMediaSummary, MobileSeason } from "@/types/mobile-api";
import { backdropUrl, getMovieContentRating, getTVContentRating, posterUrl, profileUrl, stillUrl } from "@/lib/tmdb";

const imageOrNull = (path: string | null | undefined, build: (path: string) => string | null) => path ? build(path) : null;
const safeText = (value: unknown) => typeof value === "string" ? value : "";
const safeRating = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

export function serializeMovieSummary(movie: Movie): MobileMediaSummary {
  return { id: movie.id, mediaType: "movie", title: safeText(movie.title), overview: safeText(movie.overview), posterUrl: imageOrNull(movie.poster_path, (p) => posterUrl(p, "w500")), backdropUrl: imageOrNull(movie.backdrop_path, (p) => backdropUrl(p, "w1280")), date: safeText(movie.release_date), rating: safeRating(movie.vote_average) };
}
export function serializeTVSummary(show: TVShow): MobileMediaSummary {
  return { id: show.id, mediaType: "tv", title: safeText(show.name), overview: safeText(show.overview), posterUrl: imageOrNull(show.poster_path, (p) => posterUrl(p, "w500")), backdropUrl: imageOrNull(show.backdrop_path, (p) => backdropUrl(p, "w1280")), date: safeText(show.first_air_date), rating: safeRating(show.vote_average) };
}
export function serializeMovies(value: Movie[] | null | undefined) { return Array.isArray(value) ? value.map(serializeMovieSummary) : []; }
export function serializeTVShows(value: TVShow[] | null | undefined) { return Array.isArray(value) ? value.map(serializeTVSummary) : []; }

const cast = (credits: Credits) => (Array.isArray(credits?.cast) ? credits.cast : []).slice(0, 12).map((p) => ({ id: p.id, name: safeText(p.name), role: safeText(p.character), profileUrl: imageOrNull(p.profile_path, profileUrl) }));
const seasons = (value: TVShowDetails["seasons"] | null | undefined): MobileSeason[] => (Array.isArray(value) ? value : []).filter((s) => s.season_number > 0).map((s) => ({ id: s.id, name: safeText(s.name), overview: safeText(s.overview), posterUrl: imageOrNull(s.poster_path, (p) => posterUrl(p, "w300")), seasonNumber: s.season_number, episodeCount: s.episode_count, airDate: safeText(s.air_date) }));

export function serializeMovieDetails(movie: MovieDetails, credits: Credits, related: Movie[] | null | undefined, rottenTomatoesScore: number | null): MobileMediaDetails {
  const directors = (Array.isArray(credits?.crew) ? credits.crew : []).filter((p) => p.job === "Director").map((p) => ({ id: p.id, name: safeText(p.name), role: "Director", profileUrl: imageOrNull(p.profile_path, profileUrl) }));
  return { ...serializeMovieSummary(movie), tagline: safeText(movie.tagline), genres: Array.isArray(movie.genres) ? movie.genres : [], cast: cast(credits), creators: directors, runtime: movie.runtime > 0 ? movie.runtime : null, contentRating: getMovieContentRating(movie), imdbId: movie.imdb_id || null, rottenTomatoesScore, seasons: [], related: serializeMovies(related), stream: { mediaType: "movie", tmdbId: movie.id, originalTitle: safeText(movie.original_title), year: safeText(movie.release_date).slice(0, 4), imdbId: movie.imdb_id || null } };
}

export function serializeTVDetails(show: TVShowDetails, credits: Credits, related: TVShow[] | null | undefined, rottenTomatoesScore: number | null): MobileMediaDetails {
  const creators = (Array.isArray(show.created_by) ? show.created_by : []).map((p) => ({ id: p.id, name: safeText(p.name), role: "Creator", profileUrl: imageOrNull(p.profile_path, profileUrl) }));
  const imdbId = show.external_ids?.imdb_id || null;
  const runtimes = Array.isArray(show.episode_run_time) ? show.episode_run_time : [];
  return { ...serializeTVSummary(show), tagline: safeText(show.tagline), genres: Array.isArray(show.genres) ? show.genres : [], cast: cast(credits), creators, runtime: runtimes.find((n) => n > 0) ?? null, contentRating: getTVContentRating(show), imdbId, rottenTomatoesScore, seasons: seasons(show.seasons), related: serializeTVShows(related), stream: { mediaType: "tv", tmdbId: show.id, originalTitle: safeText(show.original_name), year: safeText(show.first_air_date).slice(0, 4), imdbId } };
}

export function serializeEpisodes(value: Episode[] | null | undefined): MobileEpisode[] {
  return (Array.isArray(value) ? value : []).map((e) => ({ id: e.id, name: safeText(e.name), overview: safeText(e.overview), episodeNumber: e.episode_number, seasonNumber: e.season_number, stillUrl: imageOrNull(e.still_path, stillUrl), airDate: e.air_date || null, runtime: typeof e.runtime === "number" && e.runtime > 0 ? e.runtime : null, rating: safeRating(e.vote_average) }));
}
