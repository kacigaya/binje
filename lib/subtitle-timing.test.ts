import { expect, test } from "bun:test";
import { applySync, cueTimes, parseCues } from "./subtitle-timing";

test("reads cue times from WebVTT and SRT, with or without hours", () => {
  expect(cueTimes("WEBVTT\n\n00:15.020 --> 00:16.770\nHi\n\n1:02:03.004 --> 1:02:05.000 line:90%\nYo\n"))
    .toEqual([[15.02, 16.77], [3723.004, 3725]]);
  expect(cueTimes("1\n00:00:01,000 --> 00:00:02,500\nHi\n\n2\n00:00:05,000 --> 00:00:04,000\nBroken\n"))
    .toEqual([[1, 2.5]]);
});

test("applies offset after scale", () => {
  expect(applySync(10, { offset: 2, scale: 1.5 })).toBe(17);
});

test("parses cue text from WebVTT and SRT without markup", () => {
  expect(parseCues("WEBVTT\n\nNOTE skip me\n\nintro\n00:15.020 --> 00:16.770 line:90%\n<v Bart><i>Hi</i> &amp; bye</v>\n<c.yellow>two</c>\n\n00:01.000 --> 00:02.000\nFirst\n"))
    .toEqual([{ start: 1, end: 2, text: "First" }, { start: 15.02, end: 16.77, text: "Hi & bye\ntwo" }]);
  expect(parseCues("\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n{\\an8}Top\r\n\r\n2\r\n00:00:05,000 --> 00:00:04,000\r\nBroken\r\n\r\n3\r\n00:00:06,000 --> 00:00:07,000\r\n\r\n"))
    .toEqual([{ start: 1, end: 2.5, text: "Top" }]);
});
