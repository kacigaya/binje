import { expect, test } from "bun:test";
import { getMovieContentRating, getTVContentRating, normalizeForMatch } from "@/lib/tmdb";
import type { MovieDetails, TVShowDetails } from "@/types/tmdb";

test("normalizes French accents for search matching", () => {
  expect(normalizeForMatch("Amélie Poulain")).toBe("ameliepoulain");
  expect(normalizeForMatch("L'été dernier")).toBe("letedernier");
});

test("reads and formats French content ratings", () => {
  const movie = { release_dates: { results: [
    { iso_3166_1: "US", release_dates: [{ certification: "PG" }] },
    { iso_3166_1: "FR", release_dates: [{ certification: "" }, { certification: "-18" }] },
  ] } } as MovieDetails;
  const show = { content_ratings: { results: [
    { iso_3166_1: "FR", rating: "Tous publics" },
  ] } } as TVShowDetails;
  const numericShow = { content_ratings: { results: [
    { iso_3166_1: "FR", rating: "+16" },
  ] } } as TVShowDetails;
  const missing = { content_ratings: { results: [
    { iso_3166_1: "US", rating: "TV-PG" },
  ] } } as TVShowDetails;

  expect(getMovieContentRating(movie)).toBe("+18");
  expect(getTVContentRating(show)).toBe("Tous publics");
  expect(getTVContentRating(numericShow)).toBe("+16");
  expect(getTVContentRating(missing)).toBeNull();
});
