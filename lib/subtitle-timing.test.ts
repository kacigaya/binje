import { expect, test } from "bun:test";
import { applySync, cueTimes, fitToDuration, SCALES } from "./subtitle-timing";

test("reads cue times from WebVTT and SRT, with or without hours", () => {
  expect(cueTimes("WEBVTT\n\n00:15.020 --> 00:16.770\nHi\n\n1:02:03.004 --> 1:02:05.000 line:90%\nYo\n"))
    .toEqual([[15.02, 16.77], [3723.004, 3725]]);
  expect(cueTimes("1\n00:00:01,000 --> 00:00:02,500\nHi\n\n2\n00:00:05,000 --> 00:00:04,000\nBroken\n"))
    .toEqual([[1, 2.5]]);
});

test("ranks files by where their last line lands and slows ones that run past the end", () => {
  expect(fitToDuration(1250, 1320)).toEqual({ rank: 0, scale: 1 });
  // Ends early: long credits or a partial file, so no timing change.
  expect(fitToDuration(600, 1320)).toEqual({ rank: 1, scale: 1 });
  // Timed for film rate on a 25 fps video: about 4% too long.
  expect(fitToDuration(1300 / SCALES[2], 1320)).toEqual({ rank: 0, scale: SCALES[2] });
  expect(fitToDuration(2000, 1320)).toEqual({ rank: 2, scale: 1 });
  expect(fitToDuration(0, 1320)).toEqual({ rank: 1, scale: 1 });
});

test("applies offset after scale", () => {
  expect(applySync(10, { offset: 2, scale: 1.5 })).toBe(17);
});
