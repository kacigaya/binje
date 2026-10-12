import { expect, test } from "bun:test";
import { pickSubtitles } from "./wyzie";

const entry = (fields: Record<string, unknown>) => ({
  id: "1",
  url: "https://sub.wyzie.io/c/a/id/1?format=srt&tok=x",
  language: "en",
  format: "srt",
  isHearingImpaired: false,
  ai: false,
  ...fields,
});

test("keeps one subtitle per language, French first, preferring non-SDH", () => {
  expect(pickSubtitles([
    entry({ id: "1", isHearingImpaired: true }),
    entry({ id: 2 }),
    entry({ id: "3", language: "fr", isHearingImpaired: true }),
    entry({ id: "4" }),
  ])).toEqual([
    { id: "3", url: entry({}).url, language: "fr", hearingImpaired: true },
    { id: "2", url: entry({}).url, language: "en", hearingImpaired: false },
  ]);
});

test("drops AI translations, other formats, other languages, and foreign URLs", () => {
  expect(pickSubtitles([
    entry({ ai: true }),
    entry({ format: "sub" }),
    entry({ language: "de" }),
    entry({ url: "https://evil.test/sub.srt" }),
    entry({ id: null }),
    "junk",
  ])).toEqual([]);
  expect(pickSubtitles({ code: 400, message: "No subtitles found" })).toEqual([]);
});
