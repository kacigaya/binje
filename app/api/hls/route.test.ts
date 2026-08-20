import { afterEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { createCastToken } from "@/lib/cast-token";
import { allowStreamHost } from "@/lib/hls-hosts";
import { GET, OPTIONS } from "./route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function castRequest(token: string, method = "GET") {
  const requestUrl = new URL("https://binje.test/api/hls");
  requestUrl.searchParams.set("url", "https://203.0.113.10/master.m3u8");
  requestUrl.searchParams.set("castToken", token);
  return new NextRequest(requestUrl, {
    method,
    headers: { origin: "https://receiver.test" },
  });
}

describe("Cast HLS access", () => {
  test("permits token-bound receiver preflights only", () => {
    allowStreamHost("https://203.0.113.10/master.m3u8");
    const token = createCastToken();

    const allowed = OPTIONS(castRequest(token, "OPTIONS"));
    const denied = OPTIONS(castRequest("a".repeat(32), "OPTIONS"));

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://receiver.test",
    );
    expect(allowed.headers.get("access-control-allow-headers")).toBe(
      "Accept-Encoding, Content-Type, Range",
    );
    expect(denied.status).toBe(403);
  });

  test("keeps receiver authorization on rewritten playlist resources", async () => {
    allowStreamHost("https://203.0.113.10/master.m3u8");
    const token = createCastToken();
    globalThis.fetch = mock(async () =>
      new Response(
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts\n',
        { headers: { "content-type": "application/vnd.apple.mpegurl" } },
      ),
    ) as unknown as typeof fetch;

    const response = await GET(castRequest(token));
    const playlist = await response.text();
    const keyUrl = new URL(playlist.match(/URI="([^"]+)"/)![1], "https://binje.test");
    const segmentUrl = new URL(playlist.trim().split("\n").at(-1)!, "https://binje.test");

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://receiver.test",
    );
    expect(keyUrl.searchParams.get("castToken")).toBe(token);
    expect(segmentUrl.searchParams.get("castToken")).toBe(token);
  });
});
