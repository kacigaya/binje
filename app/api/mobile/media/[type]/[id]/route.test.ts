import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET, mediaDependencies } from "./route";
const original = { ...mediaDependencies }; afterEach(() => Object.assign(mediaDependencies, original));
beforeEach(() => { mediaDependencies.getMovieImages = async () => { throw new Error("unavailable"); }; mediaDependencies.getTVImages = async () => { throw new Error("unavailable"); }; });
const context = (type: string, id: string) => ({ params: Promise.resolve({ type, id }) });
describe("mobile media route", () => {
  test("rejects bad path parameters", async () => { expect((await GET(new NextRequest("http://localhost/api/mobile/media/person/1"), context("person", "1"))).status).toBe(400); expect((await GET(new NextRequest("http://localhost/api/mobile/media/movie/no"), context("movie", "no"))).status).toBe(400); });
  test("maps unavailable titles to 404 without raw errors", async () => { mediaDependencies.getMovieDetails = async () => { throw new Error("TMDB API error: 404"); }; const response = await GET(new NextRequest("http://localhost/api/mobile/media/movie/9"), context("movie", "9")); expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Media not found." } }); });
  test("includes logoUrl from images, null when images fail", async () => {
    mediaDependencies.getMovieDetails = async () => ({ id: 9, title: "M", overview: "", poster_path: null, backdrop_path: null, release_date: "2020-01-01", vote_average: 7, tagline: "", genres: [], runtime: 100, imdb_id: "tt1", original_title: "M", release_dates: { results: [] } }) as never;
    mediaDependencies.getMovieCredits = async () => ({ cast: [], crew: [] }) as never;
    mediaDependencies.getSimilarMovies = async () => [];
    mediaDependencies.getRottenTomatoesScore = async () => null;
    const failed = await (await GET(new NextRequest("http://localhost/api/mobile/media/movie/9"), context("movie", "9"))).json();
    expect(failed.logoUrl).toBeNull();
    mediaDependencies.getMovieImages = async () => ({ id: 9, logos: [{ file_path: "/l.png", iso_639_1: "en", width: 400, height: 150 }], backdrops: [], posters: [] }) as never;
    const body = await (await GET(new NextRequest("http://localhost/api/mobile/media/movie/9"), context("movie", "9"))).json();
    expect(body.logoUrl).toContain("/l.png");
  });
});
