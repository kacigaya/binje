import { expect, test } from "bun:test";
import { cine4kUrl, resolveCine4kStream } from "@/lib/cine4k";

test("builds the movie master URL from the TMDB id", () => {
  expect(cine4kUrl({ type: "movie", id: "693134" })).toBe("https://cine4k.mpddash.workers.dev/movie/693134.m3u8");
});

test("has no TV streams and rejects malformed ids", async () => {
  expect(cine4kUrl({ type: "tv", id: "1399" })).toBeUndefined();
  expect(cine4kUrl({ type: "movie", id: "1/../x" })).toBeUndefined();
  await expect(
    resolveCine4kStream({ type: "tv", id: "1399", title: "x", year: "2011", imdbId: "", season: "1", episode: "1" }),
  ).rejects.toThrow("movies only");
});
