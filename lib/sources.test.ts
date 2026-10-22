import { expect, test } from "bun:test";
import { isPlaybackSource, parseResolveParams, PLAYBACK_SOURCES } from "./sources";

test("plays the servers in preference order", () => {
  expect(PLAYBACK_SOURCES).toEqual(["vidsu", "vidme", "vidru"]);
});

test("accepts every listed source and nothing else", () => {
  expect(isPlaybackSource("vidru")).toBe(true);
  expect(isPlaybackSource("athena")).toBe(false);
  expect(isPlaybackSource("en")).toBe(false);
  expect(isPlaybackSource("toString")).toBe(false);
});

test("parses a title query and rejects malformed ones", () => {
  const query = (value: string) => parseResolveParams(new URLSearchParams(value));
  expect(query("type=tv&id=95350&title=Lanterns&year=2026&imdbId=tt26545992&season=1&episode=2")).toEqual({
    type: "tv", id: "95350", title: "Lanterns", year: "2026", imdbId: "tt26545992", season: "1", episode: "2",
  });
  expect(query("type=movie&id=1&title=X&year=2020")?.season).toBe("1");
  expect(query("type=tv&id=1&title=X&year=2020&season=0&episode=1")).toBeNull();
  expect(query("type=movie&id=1x&title=X&year=2020")).toBeNull();
  expect(query("type=movie&id=1&title=&year=2020")).toBeNull();
  expect(query("type=movie&id=1&title=X&year=2020&imdbId=nm1")).toBeNull();
});
