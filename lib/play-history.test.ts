import { describe, expect, test } from "bun:test";
import { getPlaybackProgress } from "./play-history";

describe("getPlaybackProgress", () => {
  test("returns progress strictly between start and end", () => {
    expect(getPlaybackProgress({ progress: 0.42 })).toBe(0.42);
  });

  test("hides entries that have not started or are finished", () => {
    expect(getPlaybackProgress({ progress: 0 })).toBeNull();
    expect(getPlaybackProgress({ progress: 1 })).toBeNull();
  });

  test("hides missing or malformed progress", () => {
    expect(getPlaybackProgress(undefined)).toBeNull();
    expect(getPlaybackProgress({})).toBeNull();
    expect(getPlaybackProgress({ progress: Number.NaN })).toBeNull();
  });
});
