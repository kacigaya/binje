import { expect, test } from "bun:test";
import { flix2watchCandidates, vidrockCandidates, xpassCandidates } from "@/lib/vidsu";

test("takes Vidrock's original HLS URLs with the Referer from their proxy link", () => {
  expect(
    vidrockCandidates({
      success: true,
      sources: [
        {
          url: "https://themoviebox.uk/proxy?url=x&referer=https%3A%2F%2Fvidrock.to%2F",
          original_url: "https://cdn.test/movie/master.m3u8",
          type: "hls",
        },
        { url: "https://themoviebox.uk/proxy?url=y", original_url: "https://cdn.test/movie.mp4", type: "mp4" },
        { original_url: "javascript:alert(1)", type: "hls" },
      ],
    }),
  ).toEqual([{ url: "https://cdn.test/movie/master.m3u8", referer: "https://vidrock.to/" }]);
  expect(vidrockCandidates({ success: false })).toEqual([]);
});

test("plays Xpass through its signed proxy with the player's Referer", () => {
  expect(
    xpassCandidates({
      streams: [
        { format: "HLS", url: "https://api.test/proxy?url=a&sig=1", raw_url: "https://vip.test/master.m3u8" },
        { format: "MP4", url: "https://api.test/proxy?url=b&sig=2" },
      ],
    }),
  ).toEqual([{ url: "https://api.test/proxy?url=a&sig=1", referer: "https://player-4aq.pages.dev/" }]);
  expect(xpassCandidates({ streams: "none" })).toEqual([]);
});

test("keeps Flix2Watch HLS and drops its MP4 films", () => {
  expect(flix2watchCandidates({ signed_url: "https://f2w.test/tv_stream/S01E01/index.m3u8?token=t" })).toEqual([
    { url: "https://f2w.test/tv_stream/S01E01/index.m3u8?token=t" },
  ]);
  expect(flix2watchCandidates({ signed_url: "https://f2w.test/stream/Movie.mp4?token=t" })).toEqual([]);
  expect(flix2watchCandidates(null)).toEqual([]);
});
