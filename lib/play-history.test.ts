import { describe, expect, test } from "bun:test";
import {
  getPlaybackProgress,
  getResumePosition,
  type PlayHistoryItem,
} from "./play-history";

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

describe("getResumePosition", () => {
  const base = {
    title: "Title",
    poster_path: null,
    backdrop_path: null,
    date: "2020-01-01",
    vote_average: 7,
    watchedAt: 1,
  };
  const history: PlayHistoryItem[] = [
    { ...base, type: "movie", id: 1, progress: 0.5, positionSeconds: 600, durationSeconds: 1200 },
    { ...base, type: "tv", id: 2, season: 3, episode: 4, progress: 0.25, positionSeconds: 300, durationSeconds: 1200 },
    { ...base, type: "movie", id: 3, progress: 1, positionSeconds: 1200, durationSeconds: 1200 },
  ];

  test("returns the saved position for the same movie", () => {
    expect(getResumePosition(history, { type: "movie", id: 1 })).toBe(600);
  });

  test("matches TV entries by episode", () => {
    expect(getResumePosition(history, { type: "tv", id: 2, season: 3, episode: 4 })).toBe(300);
    expect(getResumePosition(history, { type: "tv", id: 2, season: 3, episode: 5 })).toBeNull();
  });

  test("ignores finished and unknown titles", () => {
    expect(getResumePosition(history, { type: "movie", id: 3 })).toBeNull();
    expect(getResumePosition(history, { type: "movie", id: 99 })).toBeNull();
  });
});
