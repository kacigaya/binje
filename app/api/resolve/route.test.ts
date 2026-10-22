import { expect, test } from "bun:test";
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
