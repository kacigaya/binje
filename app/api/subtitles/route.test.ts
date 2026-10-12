import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const TITLE = "type=tv&id=312359&title=Show&year=2026&season=1&episode=1";
const originalKey = process.env.WYZIE_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.WYZIE_API_KEY;
  else process.env.WYZIE_API_KEY = originalKey;
});

const get = (query: string) => GET(new NextRequest(`http://localhost/api/subtitles?${query}`));

test("rejects invalid titles and subtitle ids", async () => {
  expect((await get("type=tv&id=x")).status).toBe(400);
  expect((await get(`${TITLE}&sub=../../etc`)).status).toBe(400);
});

test("lists nothing and serves no files without a key", async () => {
  delete process.env.WYZIE_API_KEY;
  const list = await get(TITLE);
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual({ tracks: [] });
  expect((await get(`${TITLE}&sub=123`)).status).toBe(404);
});
