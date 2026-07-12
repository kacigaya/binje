import { describe, expect, test } from "bun:test";
import { serializeMovieSummary, serializeTVSummary, serializeMovieDetails, serializeEpisodes } from "./mobile-api";

const movie = { id: 1, title: "Movie", overview: "Plot", poster_path: "/p.jpg", backdrop_path: "/b.jpg", release_date: "2026-01-02", vote_average: 8.2 };
const tv = { id: 2, name: "Show", overview: "TV plot", poster_path: null, backdrop_path: null, first_air_date: "2025-03-04", vote_average: 7.1 };

describe("mobile API serializers", () => {
  test("converts movies to stable camelCase summaries", () => {
    expect(serializeMovieSummary(movie as never)).toEqual({ id: 1, mediaType: "movie", title: "Movie", overview: "Plot", posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg", backdropUrl: "https://image.tmdb.org/t/p/w1280/b.jpg", date: "2026-01-02", rating: 8.2 });
  });
  test("converts TV and preserves missing artwork as null", () => {
    expect(serializeTVSummary(tv as never)).toEqual({ id: 2, mediaType: "tv", title: "Show", overview: "TV plot", posterUrl: null, backdropUrl: null, date: "2025-03-04", rating: 7.1 });
  });
  test("normalizes invalid arrays", () => expect(serializeEpisodes(null as never)).toEqual([]));
  test("converts movie details, cast, director and stream metadata", () => {
    const result = serializeMovieDetails({ ...movie, tagline: "Hi", genres: [{ id: 9, name: "Drama" }], runtime: 123, imdb_id: "tt123", original_title: "Original", release_dates: { results: [] } } as never, { cast: [{ id: 4, name: "Actor", character: "Lead", profile_path: "/a.jpg" }], crew: [{ id: 5, name: "Director", job: "Director", profile_path: null }] } as never, [], 91);
    expect(result.creators[0]).toEqual({ id: 5, name: "Director", role: "Director", profileUrl: null });
    expect(result.cast[0]?.profileUrl).toBe("https://image.tmdb.org/t/p/w185/a.jpg");
    expect(result.stream).toEqual({ mediaType: "movie", tmdbId: 1, originalTitle: "Original", year: "2026", imdbId: "tt123" });
    expect(result.rottenTomatoesScore).toBe(91);
  });
});
