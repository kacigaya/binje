import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";
import * as sources from "@/lib/sources";
import { GET } from "./route";

const query = "type=movie&id=278&title=Movie&year=1994";
const get = (audio = "") => GET(new NextRequest(`https://binje.test/api/sources?${query}${audio}`));
afterEach(() => { mock.restore(); });

test("defaults to VO and accepts an explicit VO lane", async () => {
  const available = spyOn(sources, "availablePlaybackSources").mockResolvedValue(["vidsu", "vidcore"]);
  expect(await (await get()).json()).toEqual({ sources: ["vidsu", "vidcore"] });
  expect(available.mock.calls[0][1]).toBe("vo");
  await get("&audio=vo");
  expect(available.mock.calls[1][1]).toBe("vo");
});

test("requests only the VF lane and preserves empty availability", async () => {
  const available = spyOn(sources, "availablePlaybackSources").mockResolvedValue([]);
  expect(await (await get("&audio=vf")).json()).toEqual({ sources: [] });
  expect(available.mock.calls[0][1]).toBe("vf");
  expect(available.mock.calls[0][0].audio).toBeUndefined();
});

test("rejects unsupported availability audio", async () => {
  expect((await get("&audio=vostfr")).status).toBe(400);
  expect((await get("&audio=")).status).toBe(400);
});
