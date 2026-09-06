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

test("rewrites mislabeled redirected playlists against the final URL and inherits referer", async () => {
  allowStreamHost("https://203.0.113.11/opaque", "https://provider.test/");
  const seen: string[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("referer") ?? "");
    return seen.length === 1
      ? new Response(null, { status: 302, headers: { location: "https://203.0.113.12/path/master" } })
      : new Response("#EXTM3U\nvariant/index.m3u8\n", { headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  const result = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.11/opaque"));
  expect(result.status).toBe(200);
  expect(result.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
  const child = new URL((await result.text()).trim().split("\n")[1], "https://binje.test");
  expect(child.searchParams.get("url")).toBe("https://203.0.113.12/path/variant/index.m3u8");
  await GET(new NextRequest(child));
  expect(seen).toEqual(Array(3).fill("https://provider.test/"));
});

test("rejects HTML and redirects into private networks", async () => {
  allowStreamHost("https://203.0.113.13/master");
  const request = new NextRequest("https://binje.test/api/hls?url=https://203.0.113.13/master");
  globalThis.fetch = mock(async () => new Response("<html>blocked</html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  expect((await GET(request)).status).toBe(502);
  globalThis.fetch = mock(async () => new Response("<script>alert(1)</script>", { status: 403, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  expect((await GET(request)).status).toBe(502);
  globalThis.fetch = mock(async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })) as unknown as typeof fetch;
  expect((await GET(request)).status).toBe(502);
});
