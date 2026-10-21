import { expect, test } from "bun:test";
import { unwrapRelay, vidrockStreams } from "./vidrock";

function relay(url: string, headers: Record<string, string> = {}) {
  return `https://02pcembed.site/v1/proxy?data=${encodeURIComponent(JSON.stringify({ url, headers }))}`;
}

test("unwraps the relay to the real target and its headers", () => {
  expect(unwrapRelay(relay("https://cdn.test/a.m3u8", { Referer: "https://vidrock.net/movie/1", "User-Agent": "UA" })))
    .toEqual({ url: "https://cdn.test/a.m3u8", referer: "https://vidrock.net/movie/1", userAgent: "UA" });
  expect(unwrapRelay("https://cdn.test/direct.m3u8")).toEqual({ url: "https://cdn.test/direct.m3u8" });
  expect(unwrapRelay(relay("file:///etc/passwd"))).toBeUndefined();
  expect(unwrapRelay("https://02pcembed.site/v1/proxy?data=not-json")).toBeUndefined();
});

test("keeps HLS sources and WebVTT subtitles", () => {
  const { streams, tracks } = vidrockStreams({
    sources: [{ url: relay("https://cdn.test/a.m3u8"), type: "hls" }, { url: relay("https://cdn.test/b.mp4"), type: "mp4" }],
    subtitles: [{ url: relay("https://subs.test/en.vtt"), label: "English", format: "vtt" }, { url: relay("https://subs.test/x.srt"), format: "srt" }],
  });
  expect(streams.map((stream) => stream.url)).toEqual(["https://cdn.test/a.m3u8"]);
  expect(tracks).toEqual([{ file: "https://subs.test/en.vtt", label: "English" }]);
});
