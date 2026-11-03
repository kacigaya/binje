import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { searchMulti, searchSuggestions, normalizeForMatch } from "@/lib/tmdb";
import type { MultiSearchResult } from "@/types/tmdb";

const movie: MultiSearchResult = {
  id: 278,
  media_type: "movie",
  title: "Les Évadés",
  original_title: "The Shawshank Redemption",
  overview: "Résumé en français",
  poster_path: "/fr.jpg",
  vote_count: 100,
};

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => fetchSpy?.mockRestore());

function mockFetch(implementation: (input: Parameters<typeof fetch>[0]) => Promise<Response>) {
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(implementation, { preconnect: globalThis.fetch.preconnect }),
  );
}

function mockSearch(results: MultiSearchResult[], totalPages = 1) {
  const requests: URL[] = [];
  mockFetch(async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    return Response.json({
      page: Number(url.searchParams.get("page")),
      results,
      total_pages: totalPages,
      total_results: results.length,
    });
  });
  return requests;
}

for (const [name, search] of [
  ["full search", (q: string, lang: "en" | "fr") => searchMulti(q, 1, lang)],
  ["suggestions", searchSuggestions],
] as const) {
  describe(name, () => {
    test("English title returns the French movie and metadata", async () => {
      const requests = mockSearch([movie]);
      const data = await search("The Shawshank Redemption", "fr");
      expect(data.results).toEqual([movie]);
      expect(requests[0].searchParams.get("query")).toBe("The Shawshank Redemption");
      expect(requests.filter((url) => url.searchParams.get("language") === "fr-FR").length > 0).toBe(true);
    });

    test("French title keeps the English result even without its matching alias", async () => {
      const english = { ...movie, title: "The Shawshank Redemption", overview: "English synopsis", poster_path: "/en.jpg" };
      const requests = mockSearch([english]);
      const data = await search("Les Évadés", "en");
      expect(data.results).toEqual([english]);
      expect(requests[0].searchParams.get("query")).toBe("Les Évadés");
      expect(requests.filter((url) => url.searchParams.get("language") === "en-US").length > 0).toBe(true);
    });

    test("original Japanese title is sent intact and returns a localized movie", async () => {
      const chihiro = { ...movie, id: 129, title: "Le Voyage de Chihiro", original_title: "千と千尋の神隠し" };
      const requests = mockSearch([chihiro]);
      expect((await search("千と千尋の神隠し", "fr")).results).toEqual([chihiro]);
      expect(requests[0].searchParams.get("query")).toBe("千と千尋の神隠し");
    });

    test("keeps alternative-title matches not present in the returned titles", async () => {
      const edge = { ...movie, id: 137113, title: "Edge of Tomorrow", original_title: "Edge of Tomorrow" };
      mockSearch([edge]);
      expect((await search("Live Die Repeat", "en")).results).toEqual([edge]);
    });

    test("normalizes case, accents, punctuation and whitespace without prefix queries", async () => {
      const requests = mockSearch([movie]);
      await search("  LES   ÉVADÉS!!! ", "en");
      expect([...new Set(requests.map((url) => url.searchParams.get("query")))]).toEqual([
        "LES ÉVADÉS!!!", "les evades", "lesevades",
      ]);
    });

    test("deduplicates by type and TMDB ID, not title", async () => {
      const otherMovie = { ...movie, id: 999 };
      const show: MultiSearchResult = { ...movie, media_type: "tv", name: movie.title };
      mockSearch([movie, movie, otherMovie, show]);
      const data = await search("Les Évadés", "en");
      expect(data.results).toHaveLength(3);
      expect(new Set(data.results.map((result) => `${result.media_type}-${result.id}`)).size).toBe(3);
      expect(data.total_results).toBe(3);
    });

    test("ranks an original-title match ahead of a popular unrelated title", async () => {
      mockSearch([{ ...movie, id: 999, title: "Unrelated", original_title: "Unrelated", vote_count: 100000 }, movie]);
      expect((await search("The Shawshank Redemption", "fr")).results[0].id).toBe(278);
    });

    test("does not request empty or punctuation-only queries", async () => {
      const requests = mockSearch([]);
      expect((await search(" !!! ", "fr")).results).toEqual([]);
      expect((await search(" ", "en")).total_pages).toBe(0);
      expect(requests).toHaveLength(0);
    });

    test("reports upstream failure instead of an empty successful search", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
      await expect(search("Les Évadés", "en")).rejects.toThrow("TMDB search failed");
    });

    test("keeps selected-language results if the other locale fails", async () => {
      mockFetch(async (input) => {
        if (new URL(String(input)).searchParams.get("language") === "en-US") {
          return new Response(null, { status: 503 });
        }
        return Response.json({ page: 1, results: [movie], total_pages: 1, total_results: 1 });
      });
      expect((await search("Les Évadés", "fr")).results).toEqual([movie]);
    });

    test("does not show the other language if all display requests fail", async () => {
      mockFetch(async (input) => {
        if (new URL(String(input)).searchParams.get("language") === "en-US") {
          return new Response(null, { status: 503 });
        }
        return Response.json({ page: 1, results: [movie], total_pages: 1, total_results: 1 });
      });
      await expect(search("Les Évadés", "en")).rejects.toThrow("TMDB search failed");
    });

    test("keeps successful results when a query variation fails", async () => {
      mockFetch(async (input) => {
        if (new URL(String(input)).searchParams.get("query") !== "Les Évadés") {
          return new Response(null, { status: 503 });
        }
        return Response.json({ page: 1, results: [movie], total_pages: 1, total_results: 1 });
      });
      expect((await search("Les Évadés", "fr")).results).toEqual([movie]);
    });
  });
}

test("full search preserves explicit page requests and upstream page count", async () => {
  const requests = mockSearch([movie], 8);
  const data = await searchMulti("Les Évadés", 4, "en");
  expect(data.page).toBe(4);
  expect(data.total_pages).toBe(8);
  expect(requests.every((url) => url.searchParams.get("page") === "4")).toBe(true);
});

test("suggestions only fetch page one and exclude people", async () => {
  const requests = mockSearch([movie, { id: 123, media_type: "person", name: "Actor", poster_path: null }]);
  expect((await searchSuggestions("Les Évadés", "fr")).results).toEqual([movie]);
  expect(requests.every((url) => url.searchParams.get("page") === "1")).toBe(true);
});

test("matching retains non-Latin titles and normalizes French ligatures", () => {
  expect(normalizeForMatch("千と千尋の神隠し")).toBe("千と千尋の神隠し");
  expect(normalizeForMatch("CŒUR, L’été! 2")).toBe("coeurlete2");
});

for (const search of [searchMulti, (q: string, _page: number, locale: "en" | "fr") => searchSuggestions(q, locale)]) {
  test("uses translated titles by ID for ranking and keeps selected-language metadata", async () => {
    const english = { ...movie, title: "The Shawshank Redemption", overview: "English synopsis" };
    const otherMovie = { ...movie, id: 202695, title: "The Fugitives", original_title: "Les Évadés", vote_count: 0 };
    const show: MultiSearchResult = { ...movie, media_type: "tv", title: "Unrelated", original_title: "Unrelated" };
    mockFetch(async (input) => {
      const french = new URL(String(input)).searchParams.get("language") === "fr-FR";
      return Response.json({ page: 1, results: french ? [movie] : [otherMovie, english, show], total_pages: 1, total_results: 3 });
    });
    const data = await search("Les Évadés", 1, "en");
    expect(data.results[0]).toEqual(english);
    expect(data.results.find((r) => r.media_type === "tv")).toEqual(show);
    expect(data.results).toHaveLength(3);
  });
}
