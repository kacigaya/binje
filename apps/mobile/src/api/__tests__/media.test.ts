import * as client from "../client";
import { browseMedia, getHome, getMediaDetails, getSeason, searchMedia } from "../media";

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
});
