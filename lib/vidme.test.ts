import { expect, test } from "bun:test";
import { pageToken, vidmeCandidates } from "@/lib/vidme";

test("reads the API token from the escaped page payload", () => {
  const html = String.raw`self.__next_f.push([1,"{\"type\":\"movie\",\"apiToken\":\"eyJpZCI6IjEifQ.sig-_1\",\"theme\":null}"])`;
  expect(pageToken(html)).toBe("eyJpZCI6IjEifQ.sig-_1");
  expect(pageToken("<p>none</p>")).toBeUndefined();
});

test("resolves relative HLS stream paths on the site and skips other formats", () => {
  expect(
    vidmeCandidates({
      provider: "mars",
      sources: [
        { url: "/api/stream/v1_abc", type: "hls" },
        { url: "/api/stream/v1_def", type: "mp4" },
        { url: "/api/stream/v1_ghi", type: "dash" },
      ],
    }),
  ).toEqual([{ url: "https://vidzen.fun/api/stream/v1_abc", referer: "https://vidzen.fun/" }]);
  expect(vidmeCandidates({ error: "Mars returned no streams for this media", sources: [] })).toEqual([]);
});
