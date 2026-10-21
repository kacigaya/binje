import { afterEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { clearWeCollegeCache } from "@/lib/wecollege";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearWeCollegeCache();
});

const MEDIA_PLAYLIST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:6",
  "#EXT-X-ENDLIST",
  "#EXTINF:6.000,",
  "https://example.com/seg.m4s",
].join("\n");

// The provider encrypts with the same cipher the Movy player uses.
const ENCRYPTED =
  "TC8Q0fxV82eu5QP2PWcIhWO1wI5jFul4y53kFE34R7tk-33TTMRpqBtyIlLrU_5wL1wicN8A57XGYPXZRvSpO2bSOBVkhQZCgGqxb4yVvhpcFtCErTJE-PzLFg";

describe("GET", () => {
  test("rejects missing metadata", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/resolve?type=movie&id=299534"),
    );

    expect(response.status).toBe(400);
  });

  test("rejects invalid TV episode numbers", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/resolve?type=tv&id=1399&title=Game%20of%20Thrones&year=2011&season=0&episode=1",
      ),
    );

    expect(response.status).toBe(400);
  });

  test("rejects unknown playback sources", async () => {
    const response = await GET(
      new NextRequest(
        "https://binje.test/api/resolve?source=unknown&type=movie&id=278&title=Movie&year=1994",
      ),
    );

    expect(response.status).toBe(400);
  });
});

test("resolves the provider stream and keeps its headers server-side", async () => {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/sources?")) return new Response(ENCRYPTED);
    return new Response(MEDIA_PLAYLIST);
  }) as unknown as typeof fetch;

  const response = await GET(
    new NextRequest("https://binje.test/api/resolve?type=movie&id=550&title=Fight%20Club&year=1999"),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    url: "https://example.com/video.m3u8",
    tracks: [],
    sources: [{ file: "https://example.com/video.m3u8", height: 1080 }],
  });
});

test("answers 502 when the provider has no stream", async () => {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/sources?")) return new Response(null, { status: 500 });
    return new Response(MEDIA_PLAYLIST);
  }) as unknown as typeof fetch;

  const response = await GET(
    new NextRequest("https://binje.test/api/resolve?type=movie&id=550&title=Fight%20Club&year=1999"),
  );

  expect(response.status).toBe(502);
});
