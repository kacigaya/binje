import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET, homeDependencies } from "./route";
const original = { ...homeDependencies };
afterEach(() => Object.assign(homeDependencies, original));
beforeEach(() => {
  homeDependencies.getMovieImages = async () => ({ id: 1, logos: [], backdrops: [], posters: [] }) as never;
  homeDependencies.getTVImages = async () => ({ id: 1, logos: [], backdrops: [], posters: [] }) as never;
  homeDependencies.getMovieDetails = async () => { throw new Error("unavailable"); };
  homeDependencies.getTVDetails = async () => { throw new Error("unavailable"); };
  homeDependencies.getRottenTomatoesScore = async () => null;
});
const movie = { id: 1, title: "M", overview: "", poster_path: null, backdrop_path: null, release_date: "", vote_average: 8 } as never;
describe("mobile home route", () => {
  test("returns camelCase sections with cache headers", async () => { homeDependencies.getTrending = async () => [movie]; homeDependencies.getTrendingTV = async () => []; const response = await GET(new NextRequest("http://localhost/api/mobile/home?lang=fr")); expect(response.status).toBe(200); expect((await response.json()).trendingMovies[0].mediaType).toBe("movie"); expect(response.headers.get("cache-control")).toContain("s-maxage"); expect(response.headers.get("netlify-vary")).toBe("query"); });
  test("enriches featured items with logo, RT score, and content rating", async () => {
    homeDependencies.getTrending = async () => [movie];
    homeDependencies.getTrendingTV = async () => [];
    homeDependencies.getMovieImages = async () => ({ id: 1, logos: [{ file_path: "/logo.png", iso_639_1: "fr", width: 500, height: 200 }], backdrops: [], posters: [] }) as never;
    homeDependencies.getMovieDetails = async () => ({ id: 1, imdb_id: "tt1", release_dates: { results: [] } }) as never;
    homeDependencies.getRottenTomatoesScore = async () => 93;
    const body = await (await GET(new NextRequest("http://localhost/api/mobile/home?lang=fr"))).json();
    expect(body.featured[0].logoUrl).toContain("/logo.png");
    expect(body.featured[0].rottenTomatoesScore).toBe(93);
    expect(body.featured[0]).toHaveProperty("contentRating");
  });
  test("keeps featured items when enrichment fails", async () => {
    homeDependencies.getTrending = async () => [movie];
    homeDependencies.getTrendingTV = async () => [];
    homeDependencies.getMovieImages = async () => { throw new Error("boom"); };
    const body = await (await GET(new NextRequest("http://localhost/api/mobile/home"))).json();
    expect(body.featured[0].id).toBe(1);
    expect(body.featured[0].logoUrl).toBeNull();
    expect(body.featured[0].rottenTomatoesScore).toBeNull();
  });
  test("returns 400 for invalid locale", async () => expect((await GET(new NextRequest("http://localhost/api/mobile/home?lang=de"))).status).toBe(400));
  test("hides upstream errors", async () => { homeDependencies.getTrending = async () => { throw new Error("secret API key"); }; expect((await GET(new NextRequest("http://localhost/api/mobile/home"))).status).toBe(502); });
});
