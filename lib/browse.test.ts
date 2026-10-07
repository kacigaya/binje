import { describe, expect, test } from "bun:test";
import {
  browseQuery,
  discoverEndpoint,
  isFiltered,
  MAX_PAGE,
  parseBrowseFilters,
  type BrowseFilters,
} from "@/lib/browse";

const GENRES = new Set([28, 35, 53]);
const DEFAULTS: BrowseFilters = { genre: null, sort: "popular", decade: null, page: 1 };

describe("parseBrowseFilters", () => {
  test("defaults when nothing is set", () => {
    expect(parseBrowseFilters({}, GENRES)).toEqual(DEFAULTS);
  });

  test("accepts known values", () => {
    expect(
      parseBrowseFilters({ genre: "53", sort: "rating", decade: "1990", page: "3" }, GENRES),
    ).toEqual({ genre: 53, sort: "rating", decade: 1990, page: 3 });
  });

  test("drops unknown or malformed values", () => {
    expect(
      parseBrowseFilters(
        { genre: "99", sort: "views", decade: "1995", page: "-2" },
        GENRES,
      ),
    ).toEqual(DEFAULTS);
    expect(parseBrowseFilters({ genre: "28abc", page: "1e3" }, GENRES)).toEqual(DEFAULTS);
  });

  test("takes the first of repeated params and caps the page", () => {
    expect(parseBrowseFilters({ genre: ["35", "28"], page: "9999" }, GENRES)).toEqual({
      ...DEFAULTS,
      genre: 35,
      page: MAX_PAGE,
    });
  });
});

describe("isFiltered", () => {
  test("is false only for the defaults", () => {
    expect(isFiltered(DEFAULTS)).toBe(false);
    expect(isFiltered({ ...DEFAULTS, sort: "newest" })).toBe(true);
    expect(isFiltered({ ...DEFAULTS, page: 2 })).toBe(true);
  });
});

describe("browseQuery", () => {
  test("omits defaults", () => {
    expect(browseQuery(DEFAULTS, {})).toBe("");
    expect(browseQuery(DEFAULTS, { genre: 28 })).toBe("?genre=28");
  });

  test("resets the page when a filter changes but not when paging", () => {
    const current = { ...DEFAULTS, genre: 28, page: 4 };
    expect(browseQuery(current, { sort: "rating" })).toBe("?genre=28&sort=rating");
    expect(browseQuery(current, { page: 5 })).toBe("?genre=28&page=5");
  });
});

describe("discoverEndpoint", () => {
  const today = "2026-10-07";

  test("popular movies", () => {
    expect(discoverEndpoint("movie", DEFAULTS, today)).toBe(
      "/discover/movie?page=1&include_adult=false&sort_by=popularity.desc",
    );
  });

  test("top rated requires a vote floor", () => {
    const url = discoverEndpoint("tv", { ...DEFAULTS, sort: "rating" }, today);
    expect(url).toContain("sort_by=vote_average.desc");
    expect(url).toContain("vote_count.gte=300");
  });

  test("newest excludes unreleased titles and respects the decade", () => {
    const recent = new URLSearchParams(
      discoverEndpoint("movie", { ...DEFAULTS, sort: "newest", decade: 2020 }, today).split("?")[1],
    );
    expect(recent.get("primary_release_date.gte")).toBe("2020-01-01");
    expect(recent.get("primary_release_date.lte")).toBe(today);
    expect(recent.get("vote_count.gte")).toBe("10");

    const older = new URLSearchParams(
      discoverEndpoint("tv", { ...DEFAULTS, sort: "newest", decade: 1990, genre: 35 }, today).split("?")[1],
    );
    expect(older.get("first_air_date.lte")).toBe("1999-12-31");
    expect(older.get("with_genres")).toBe("35");
  });
});
