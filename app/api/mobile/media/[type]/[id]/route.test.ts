import { afterEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET, mediaDependencies } from "./route";
const original = { ...mediaDependencies }; afterEach(() => Object.assign(mediaDependencies, original));
const context = (type: string, id: string) => ({ params: Promise.resolve({ type, id }) });
describe("mobile media route", () => {
  test("rejects bad path parameters", async () => { expect((await GET(new NextRequest("http://localhost/api/mobile/media/person/1"), context("person", "1"))).status).toBe(400); expect((await GET(new NextRequest("http://localhost/api/mobile/media/movie/no"), context("movie", "no"))).status).toBe(400); });
  test("maps unavailable titles to 404 without raw errors", async () => { mediaDependencies.getMovieDetails = async () => { throw new Error("TMDB API error: 404"); }; const response = await GET(new NextRequest("http://localhost/api/mobile/media/movie/9"), context("movie", "9")); expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Media not found." } }); });
});
