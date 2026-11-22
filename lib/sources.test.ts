import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { availablePlaybackSources, isPlaybackSource, parseResolveParams, PLAYBACK_SOURCES } from "./sources";
import * as network from "./safe-fetch";
import * as check from "./stream-check";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.VIDCORE_RESOLVER_URL;
const originalToken = process.env.VIDCORE_RESOLVER_TOKEN;
const params = { type: "movie" as const, id: "78001", title: "Fixture", year: "2026", imdbId: "", season: "1", episode: "1" };

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.VIDCORE_RESOLVER_URL;
  else process.env.VIDCORE_RESOLVER_URL = originalUrl;
  if (originalToken === undefined) delete process.env.VIDCORE_RESOLVER_TOKEN;
  else process.env.VIDCORE_RESOLVER_TOKEN = originalToken;
  mock.restore();
});

function setup(height: number) {
  process.env.VIDCORE_RESOLVER_URL = "http://127.0.0.1:3040";
  process.env.VIDCORE_RESOLVER_TOKEN = "fixture-token";
  const resolver = mock(async () => Response.json({ url: "https://203.0.113.17/fixture.m3u8" }));
  globalThis.fetch = resolver as unknown as typeof fetch;
  spyOn(check, "probeManifest").mockResolvedValue({ height });
  const alternatives = spyOn(network, "fetchPublic").mockImplementation(async () => new Response(null, { status: 404 }));
  return { resolver, alternatives };
}

test("skips alternative probes for quick 2160p startup but still supports full lookup", async () => {
  const { resolver, alternatives } = setup(2160);
  expect(await availablePlaybackSources(params, "vo", true)).toEqual(["vidcore"]);
  expect(alternatives).not.toHaveBeenCalled();
  expect(await availablePlaybackSources(params)).toEqual(["vidcore"]);
  expect(alternatives).toHaveBeenCalled();
  expect(resolver).toHaveBeenCalledTimes(1);
});

test("probes alternatives when preferred quality is below target", async () => {
  const { resolver, alternatives } = setup(1080);
  expect(await availablePlaybackSources({ ...params, id: "78002" }, "vo", true)).toEqual(["vidcore"]);
  expect(alternatives).toHaveBeenCalled();
  expect(resolver).toHaveBeenCalledTimes(1);
});

test("plays the servers in preference order", () => {
  expect(PLAYBACK_SOURCES).toEqual(["vidcore", "vidsu", "vidme", "vidru", "frembed"]);
});

test("accepts every listed source and nothing else", () => {
  expect(isPlaybackSource("vidru")).toBe(true);
  expect(isPlaybackSource("vidcore")).toBe(true);
  expect(isPlaybackSource("athena")).toBe(false);
  expect(isPlaybackSource("en")).toBe(false);
  expect(isPlaybackSource("toString")).toBe(false);
});

test("parses a title query and rejects malformed ones", () => {
  const query = (value: string) => parseResolveParams(new URLSearchParams(value));
  expect(query("type=tv&id=95350&title=Lanterns&year=2026&imdbId=tt26545992&season=1&episode=2")).toEqual({
    type: "tv", id: "95350", title: "Lanterns", year: "2026", imdbId: "tt26545992", season: "1", episode: "2",
  });
  expect(query("type=movie&id=1&title=X&year=2020")?.season).toBe("1");
  expect(query("type=tv&id=1&title=X&year=2020&season=0&episode=1")).toBeNull();
  expect(query("type=movie&id=1x&title=X&year=2020")).toBeNull();
  expect(query("type=movie&id=1&title=&year=2020")).toBeNull();
  expect(query("type=movie&id=1&title=X&year=2020&imdbId=nm1")).toBeNull();
});

test("parses only supported resolver audio lanes", () => {
  const query = new URLSearchParams("type=movie&id=1&title=X&year=2020&audio=vf");
  expect(parseResolveParams(query)?.audio).toBe("vf");
  query.set("audio", "vostfr");
  expect(parseResolveParams(query)).toBeNull();
  query.set("audio", "vo");
  expect(parseResolveParams(query)).toBeNull();
  query.set("audio", "");
  expect(parseResolveParams(query)).toBeNull();
});
