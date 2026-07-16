import { afterEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET, seasonDependencies } from "./route";
const original = { ...seasonDependencies }; afterEach(() => Object.assign(seasonDependencies, original));
const context = (id: string, season: string) => ({ params: Promise.resolve({ id, season }) });
describe("mobile season route", () => {
  test("serializes episodes", async () => { seasonDependencies.getSeasonEpisodes = async () => [{ id: 3, name: "Pilot", overview: "", episode_number: 1, season_number: 1, still_path: null, air_date: null, runtime: 45, vote_average: 8 }]; const response = await GET(new NextRequest("http://localhost/api/mobile/season/2/1?lang=fr"), context("2", "1")); expect(response.status).toBe(200); expect((await response.json()).episodes[0]).toMatchObject({ episodeNumber: 1, stillUrl: null }); });
  test("rejects invalid IDs and seasons", async () => { expect((await GET(new NextRequest("http://localhost"), context("bad", "1"))).status).toBe(400); expect((await GET(new NextRequest("http://localhost"), context("1", "-1"))).status).toBe(400); });
});
