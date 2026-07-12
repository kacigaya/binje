import { afterEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET, homeDependencies } from "./route";
const original = { ...homeDependencies };
afterEach(() => Object.assign(homeDependencies, original));
const movie = { id: 1, title: "M", overview: "", poster_path: null, backdrop_path: null, release_date: "", vote_average: 8 } as never;
describe("mobile home route", () => {
  test("returns camelCase sections with cache headers", async () => { homeDependencies.getTrending = async () => [movie]; homeDependencies.getTrendingTV = async () => []; const response = await GET(new NextRequest("http://localhost/api/mobile/home?lang=fr")); expect(response.status).toBe(200); expect((await response.json()).trendingMovies[0].mediaType).toBe("movie"); expect(response.headers.get("cache-control")).toContain("s-maxage"); expect(response.headers.get("netlify-vary")).toBe("query"); });
  test("returns 400 for invalid locale", async () => expect((await GET(new NextRequest("http://localhost/api/mobile/home?lang=de"))).status).toBe(400));
  test("hides upstream errors", async () => { homeDependencies.getTrending = async () => { throw new Error("secret API key"); }; expect((await GET(new NextRequest("http://localhost/api/mobile/home"))).status).toBe(502); });
});
