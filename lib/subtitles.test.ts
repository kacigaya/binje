import { expect, test } from "bun:test";
import { openSubtitlesTracks, pickSubtitleTracks } from "./subtitles";

const track = (label: string | undefined, file: string) => ({ file: `https://subs.test/${file}.vtt`, label });

test("keeps three files for site languages and one for others, numbering repeats", () => {
  expect(pickSubtitleTracks([
    track("English", "en1"),
    track("Arabic", "ar1"),
    track("English2", "en2"),
    track("Arabic hi", "ar2"),
    track("english hi1", "en3"),
    track("English", "en4"),
    track("French", "fr1"),
  ])).toEqual([
    track("English", "en1"),
    track("Arabic", "ar1"),
    track("English 2", "en2"),
    track("english 3", "en3"),
    track("French", "fr1"),
  ]);
});

test("drops unlabeled tracks and files listed twice, keeping the format", () => {
  expect(pickSubtitleTracks([
    track(undefined, "x"),
    track("  ", "y"),
    { ...track("French", "fr"), format: "srt" },
    track("French", "fr"),
  ])).toEqual([{ ...track("French", "fr"), format: "srt" }]);
});

test("maps OpenSubtitles results to UTF-8 SRT links on its download host", () => {
  expect(openSubtitlesTracks([
    { SubFormat: "srt", LanguageName: "English", SubDownloadLink: "https://dl.opensubtitles.org/en/download/src-api/vrf-1/file/2.gz" },
    { SubFormat: "sub", LanguageName: "French", SubDownloadLink: "https://dl.opensubtitles.org/en/download/file/3.gz" },
    { SubFormat: "srt", LanguageName: "French", SubDownloadLink: "https://evil.test/download/file/4.gz" },
    { SubFormat: "srt", SubDownloadLink: "https://dl.opensubtitles.org/en/download/file/5.gz" },
  ])).toEqual([
    { file: "https://dl.opensubtitles.org/en/download/subencoding-utf8/src-api/vrf-1/file/2", label: "English", format: "srt" },
  ]);
  expect(openSubtitlesTracks({ error: "x" })).toEqual([]);
});
