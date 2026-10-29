import * as client from "../client";
import { browseMedia, getHome, getMediaDetails, getSeason, searchMedia, toSearchSummary } from "../media";

jest.mock("../client", () => ({ apiRequest: jest.fn() }));
const request = client.apiRequest as jest.Mock;

describe("media API", () => {
  beforeEach(() => request.mockReset().mockResolvedValue({}));

  test("loads localized home data", async () => {
    await getHome("fr");
    expect(request).toHaveBeenCalledWith("/api/mobile/home", { query: { lang: "fr" } });
  });

  test("loads a browse category and page", async () => {
    await browseMedia("tv", "top-rated", 3, "en");
    expect(request).toHaveBeenCalledWith("/api/mobile/browse", {
      query: { type: "tv", category: "top-rated", page: 3, lang: "en" },
    });
  });

  test("loads details and season episodes", async () => {
    await getMediaDetails("movie", 42, "fr");
    await getSeason(7, 2, "fr");
    expect(request).toHaveBeenNthCalledWith(1, "/api/mobile/media/movie/42", {
      query: { lang: "fr" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/mobile/season/7/2", {
      query: { lang: "fr" },
    });
  });

  test("uses the existing ranked search endpoint", async () => {
    await searchMedia("Dune Part Two", 2, "en");
    expect(request).toHaveBeenCalledWith("/api/search", {
      query: { q: "Dune Part Two", page: 2, lang: "en" },
    });
  });

  test("builds full image URLs for raw search results", () => {
    expect(toSearchSummary({ id: 1, media_type: "tv", name: "Show", poster_path: "/p.jpg", backdrop_path: null, first_air_date: "2021-01-08" })).toEqual({
      id: 1, mediaType: "tv", title: "Show", overview: "", posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg", backdropUrl: null, date: "2021-01-08", rating: 0,
    });
  });
});
