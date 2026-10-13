import { expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const get = (query: string) => GET(new NextRequest(`http://localhost/api/subtitles/sync?${query}`));

test("rejects bad params and streams or files the proxy never registered", async () => {
  expect((await get("stream=nope&file=https://subs.test/a.vtt")).status).toBe(400);
  expect((await get("stream=https://cdn.test/m.m3u8&file=https://subs.test/a.vtt&format=ass")).status).toBe(400);
  expect((await get("stream=https://203.0.113.40/m.m3u8&file=https://203.0.113.41/a.vtt")).status).toBe(403);
});
