import { expect, test } from "bun:test";
import { rankPlaybackSources, selectPlaybackSource } from "./playback-selection";

test("ranks measured quality before provider preference", () => {
  expect(rankPlaybackSources({ vidcore: 1080, vidsu: 2160, vidme: 720, vidru: 1440 }))
    .toEqual(["vidsu", "vidru", "vidcore", "vidme"]);
});

test("puts Vidcore first when it has the best or equal quality", () => {
  expect(rankPlaybackSources({ vidcore: 2160, vidsu: 1080 })).toEqual(["vidcore", "vidsu"]);
  expect(rankPlaybackSources({ vidme: 2160, vidsu: 2160, vidcore: 2160, vidru: 2160 }))
    .toEqual(["vidcore", "vidsu", "vidme", "vidru"]);
});

test("omits unavailable providers and ranks unknown quality last", () => {
  expect(rankPlaybackSources({ vidcore: 0, vidme: 1080 })).toEqual(["vidme", "vidcore"]);
  expect(rankPlaybackSources({})).toEqual([]);
});

test("starts with Vidcore and fails over before quality probes finish", () => {
  expect(selectPlaybackSource(undefined, [])).toBe("vidcore");
  expect(selectPlaybackSource(undefined, ["vidcore"])).toBe("vidsu");
  expect(selectPlaybackSource(null, ["vidcore", "vidsu"])).toBe("vidme");
});

test("switches a running source to the best measured source", () => {
  expect(selectPlaybackSource(["vidcore", "vidsu"], [], "vidsu")).toBe("vidcore");
  expect(selectPlaybackSource(["vidcore"], [], "vidsu")).toBe("vidcore");
  expect(selectPlaybackSource(["vidsu", "vidcore"], [], "vidcore")).toBe("vidsu");
});

test("uses the next best source after a playback failure", () => {
  expect(selectPlaybackSource(["vidcore", "vidru", "vidsu"], ["vidcore"], "vidcore")).toBe("vidru");
});

test("keeps a running stream only when no ranked source can play", () => {
  expect(selectPlaybackSource(null, [], "vidsu")).toBe("vidsu");
  expect(selectPlaybackSource(undefined, [], "vidru")).toBe("vidru");
  expect(selectPlaybackSource([], [], "vidsu")).toBe("vidsu");
  expect(selectPlaybackSource(["vidcore"], ["vidcore"], "vidsu")).toBe("vidsu");
  expect(selectPlaybackSource([], ["vidsu"], "vidsu")).toBeNull();
  expect(selectPlaybackSource([], [])).toBeNull();
});
