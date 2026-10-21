import { expect, test } from "bun:test";
import { moviesapiStreams, playerKeyFromBundle } from "./moviesapi";

const KEY = "3a67e8866ae1d2bb9e81fe7f73315a56eb3bdf5e3e755c7554c8be6910aa6b13";

test("reads the player key next to the vidora path in the bundle", () => {
  expect(playerKeyFromBundle(`var a=1;var fz=\`${KEY}\`,pz=\`/api/vidora/subs/\`;`)).toBe(KEY);
  expect(playerKeyFromBundle("var nothing=1")).toBeUndefined();
});

test("keeps valid streams and their subtitle tracks", () => {
  expect(moviesapiStreams({
    sources: [
      { url: "https://cdn.test/master.m3u8", tracks: [{ file: "https://subs.test/en.vtt", label: "English" }, { file: "data:text/vtt," }] },
      { url: "ftp://cdn.test/x" },
    ],
  })).toEqual([{ url: "https://cdn.test/master.m3u8", tracks: [{ file: "https://subs.test/en.vtt", label: "English" }] }]);
  expect(moviesapiStreams({ error: "Unauthorized" })).toEqual([]);
});
