import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const resolve = (query: string) => GET(new NextRequest(`https://binje.test/api/resolve?${query}`));

test("rejects missing title metadata", async () => {
  expect((await resolve("source=vidsu&type=movie&id=299534")).status).toBe(400);
});

test("rejects invalid TV episode numbers", async () => {
  expect((await resolve("source=vidsu&type=tv&id=1399&title=Game%20of%20Thrones&year=2011&season=0&episode=1")).status).toBe(400);
});

test("rejects unknown playback sources", async () => {
  expect((await resolve("source=unknown&type=movie&id=278&title=Movie&year=1994")).status).toBe(400);
});

test("requires a playback source", async () => {
  expect((await resolve("type=movie&id=278&title=Movie&year=1994")).status).toBe(400);
});

test("rejects audio overrides on VO providers and unknown Frembed audio", async () => {
  for (const source of ["vidcore", "vidsu", "vidme", "vidru"]) {
    expect((await resolve(`source=${source}&type=movie&id=278&title=Movie&year=1994&audio=vf`)).status).toBe(400);
  }
  expect((await resolve("source=frembed&type=movie&id=278&title=Movie&year=1994&audio=vo")).status).toBe(400);
});

import * as sources from "@/lib/sources";
afterEach(() => { mock.restore(); });

test("forwards Frembed audio and keeps provider headers out of JSON", async () => {
  const playback = spyOn(sources, "resolvePlaybackSource").mockResolvedValue({
    url: "https://203.0.113.203/index.m3u8", tracks: [], referer: "https://uqload.vc/", height: 1080,
  });
  for (const audio of ["vf", "vostfr"] as const) {
    const response = await resolve(`source=frembed&type=movie&id=278&title=Movie&year=1994&audio=${audio}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://203.0.113.203/index.m3u8", tracks: [] });
    expect(playback.mock.calls.at(-1)?.[1].audio).toBe(audio);
  }
  expect((await resolve("source=frembed&type=movie&id=278&title=Movie&year=1994")).status).toBe(200);
  expect(playback.mock.calls.at(-1)?.[1].audio).toBeUndefined();
});
