import { describe, expect, test } from "bun:test";
import {
  manifestKey,
  parseLibraryManifest,
  toResolverResult,
} from "@/lib/library";

const upper = (file: string) => `https://cdn.example/${file}`;

describe("manifestKey", () => {
  test("keys movies by tmdb id", () => {
    expect(manifestKey({ type: "movie", id: "37165" })).toBe(
      "movies/37165/index.json",
    );
  });

  test("keys episodes by season and episode", () => {
    expect(
      manifestKey({ type: "tv", id: "1399", season: "2", episode: "9" }),
    ).toBe("tv/1399/s2e9/index.json");
  });

  test("defaults a series to the first episode", () => {
    expect(manifestKey({ type: "tv", id: "1399" })).toBe(
      "tv/1399/s1e1/index.json",
    );
  });
});

describe("parseLibraryManifest", () => {
  test("sorts renditions high to low and keeps labelled subtitles", () => {
    expect(
      parseLibraryManifest({
        renditions: [
          { height: 720, file: "movies/1/720p.m3u8" },
          { height: 2160, file: "movies/1/2160p.m3u8" },
          { height: 1080, file: "movies/1/1080p.m3u8" },
        ],
        subtitles: [
          { file: "movies/1/en.vtt", label: "English" },
          { file: "movies/1/fr.vtt", label: "French" },
        ],
      }),
    ).toEqual({
      renditions: [
        { height: 2160, file: "movies/1/2160p.m3u8" },
        { height: 1080, file: "movies/1/1080p.m3u8" },
        { height: 720, file: "movies/1/720p.m3u8" },
      ],
      subtitles: [
        { file: "movies/1/en.vtt", label: "English" },
        { file: "movies/1/fr.vtt", label: "French" },
      ],
    });
  });

  test("drops malformed entries and duplicate subtitle labels", () => {
    expect(
      parseLibraryManifest({
        renditions: [
          { height: 1080, file: "a.m3u8" },
          { height: 0, file: "bad.m3u8" },
          { height: 480 },
          "nonsense",
        ],
        subtitles: [
          { file: "en-1.vtt", label: "English" },
          { file: "en-2.vtt", label: "English" },
          { label: "Broken" },
          { file: "unlabelled.vtt" },
        ],
      }),
    ).toEqual({
      renditions: [{ height: 1080, file: "a.m3u8" }],
      subtitles: [{ file: "en-1.vtt", label: "English" }, { file: "unlabelled.vtt" }],
    });
  });

  test("rejects manifests with nothing playable", () => {
    expect(() => parseLibraryManifest({ renditions: [] })).toThrow(
      "Manifest has no renditions.",
    );
    expect(() => parseLibraryManifest({ subtitles: [] })).toThrow(
      "Invalid library manifest.",
    );
    expect(() => parseLibraryManifest(null)).toThrow("Invalid library manifest.");
  });
});

describe("toResolverResult", () => {
  test("defaults to 1080p and resolves every file", () => {
    expect(
      toResolverResult(
        {
          renditions: [
            { height: 2160, file: "2160p.m3u8" },
            { height: 1080, file: "1080p.m3u8" },
          ],
          subtitles: [{ file: "en.vtt", label: "English" }],
        },
        upper,
      ),
    ).toEqual({
      url: "https://cdn.example/1080p.m3u8",
      tracks: [{ file: "https://cdn.example/en.vtt", label: "English" }],
      sources: [
        { height: 2160, file: "https://cdn.example/2160p.m3u8" },
        { height: 1080, file: "https://cdn.example/1080p.m3u8" },
      ],
    });
  });

  test("falls back to the highest rendition when 1080p is absent", () => {
    const result = toResolverResult(
      {
        renditions: [
          { height: 720, file: "720p.m3u8" },
          { height: 480, file: "480p.m3u8" },
        ],
        subtitles: [],
      },
      upper,
    );

    expect(result.url).toBe("https://cdn.example/720p.m3u8");
    expect(result.tracks).toEqual([]);
  });

  test("omits sources for a single rendition so the player plays it directly", () => {
    const result = toResolverResult(
      { renditions: [{ height: 1080, file: "1080p.m3u8" }], subtitles: [] },
      upper,
    );

    expect(result.sources).toBeUndefined();
    expect(result.url).toBe("https://cdn.example/1080p.m3u8");
  });
});
