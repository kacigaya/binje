import * as client from "../../../api/client";
import { buildResolveQuery, fetchAvailableSources, resolveStream } from "../resolveStream";

jest.mock("../../../api/client", () => ({ apiRequest: jest.fn() }));
const request = client.apiRequest as jest.Mock;

describe("native stream resolver", () => {
  beforeEach(() => request.mockReset().mockResolvedValue({ url: "https://cdn.test/master.m3u8" }));

  test("builds movie resolver parameters", () => {
    expect(buildResolveQuery({ type: "movie", id: 42, title: "Dune", year: "2021", imdbId: "tt1160419" })).toEqual({
      type: "movie",
      id: 42,
      title: "Dune",
      year: "2021",
      imdbId: "tt1160419",
    });
  });

  test("requires TV episode coordinates", () => {
    expect(() => buildResolveQuery({ type: "tv", id: 9, title: "Show", year: "2024" })).toThrow("season and episode");
  });

  test("resolves WeCollege through the resolve route", async () => {
    const media = { type: "tv" as const, id: 9, title: "Show", year: "2024", season: 2, episode: 3 };
    await resolveStream(media, "wecollege");
    expect(request).toHaveBeenNthCalledWith(1, "/api/resolve", {
      query: expect.objectContaining({ source: "wecollege", season: 2, episode: 3 }),
    });
  });

  test("lists available sources in server order and drops unknown ids", async () => {
    request.mockResolvedValueOnce({ sources: ["wecollege", "future-provider", 7] });
    const sources = await fetchAvailableSources({ type: "movie", id: 1, title: "X", year: "2020" });
    expect(sources).toEqual(["wecollege"]);
    expect(request).toHaveBeenCalledWith("/api/sources", expect.objectContaining({ query: expect.objectContaining({ id: 1 }) }));
  });

  test("rejects a malformed stream response", async () => {
    request.mockResolvedValueOnce({ url: "javascript:alert(1)" });
    await expect(resolveStream({ type: "movie", id: 1, title: "X", year: "2020" }, "wecollege")).rejects.toThrow("playable stream");
  });
});
