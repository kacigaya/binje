import { afterEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { createCastToken } from "@/lib/cast-token";
import { allowStreamCookie, allowStreamHost } from "@/lib/hls-hosts";
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

test("sends a scoped cookie to the signed path and drops it on redirects elsewhere", async () => {
  allowStreamCookie("https://203.0.113.14/dash/title/", "CloudFront-Policy=p; CloudFront-Signature=s");
  allowStreamHost("https://203.0.113.15/");
  const cookies: (string | null)[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    cookies.push(new Headers(init?.headers).get("cookie"));
    return cookies.length === 1
      ? new Response(null, { status: 302, headers: { location: "https://203.0.113.15/mirror/chunk.m4s" } })
      : new Response("bytes", { headers: { "content-type": "video/iso.segment" } });
  }) as unknown as typeof fetch;
  const response = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.14/dash/title/chunk.m4s"));
  expect(response.status).toBe(200);
  expect(cookies).toEqual(["CloudFront-Policy=p; CloudFront-Signature=s", null]);
  await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.14/dash/other/chunk.m4s"));
  expect(cookies[2]).toBeNull();
});

const MPD = `<MPD type="static" mediaPresentationDuration="PT8S"><Period>
  <AdaptationSet contentType="video"><Representation id="0" mimeType="video/mp4" codecs="hev1" bandwidth="1000" width="1920" height="1080">
    <SegmentTemplate timescale="1" initialization="init-$RepresentationID$.m4s" media="chunk-$RepresentationID$-$Number$.m4s" startNumber="1"><SegmentTimeline><S t="0" d="4" r="1" /></SegmentTimeline></SegmentTemplate>
  </Representation></AdaptationSet>
  <AdaptationSet contentType="audio" lang="eng"><Representation id="1" mimeType="audio/mp4" codecs="mp4a.40.2" bandwidth="100">
    <SegmentTemplate timescale="1" initialization="init-$RepresentationID$.m4s" media="chunk-$RepresentationID$-$Number$.m4s" startNumber="1"><SegmentTimeline><S t="0" d="4" r="1" /></SegmentTimeline></SegmentTemplate>
  </Representation></AdaptationSet>
</Period></MPD>`;

test("serves a DASH manifest as HLS playlists that proxy segments with the scoped cookie", async () => {
  allowStreamCookie("https://203.0.113.16/dash/title/", "CloudFront-Policy=p");
  const requests: { url: string; cookie: string | null }[] = [];
  globalThis.fetch = mock(async (input: unknown, init?: RequestInit) => {
    requests.push({ url: String(input), cookie: new Headers(init?.headers).get("cookie") });
    return String(input).endsWith(".mpd")
      ? new Response(MPD, { headers: { "content-type": "application/octet-stream" } })
      : new Response("bytes", { headers: { "content-type": "video/iso.segment" } });
  }) as unknown as typeof fetch;

  const mpd = "https://203.0.113.16/dash/title/index.mpd";
  const master = await GET(new NextRequest(`https://binje.test/api/hls?url=${encodeURIComponent(mpd)}`));
  expect(master.status).toBe(200);
  expect(master.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
  const masterLines = (await master.text()).trim().split("\n");
  expect(masterLines[0]).toBe("#EXTM3U");
  expect(masterLines.find((line) => line.startsWith("#EXT-X-MEDIA"))).toContain(`URI="/api/hls?url=${encodeURIComponent(mpd)}&rep=1"`);
  expect(masterLines.at(-1)).toBe(`/api/hls?url=${encodeURIComponent(mpd)}&rep=0`);

  const media = await GET(new NextRequest(new URL(masterLines.at(-1)!, "https://binje.test")));
  const mediaLines = (await media.text()).trim().split("\n");
  expect(mediaLines).toContain('#EXT-X-MAP:URI="/api/hls?url=https%3A%2F%2F203.0.113.16%2Fdash%2Ftitle%2Finit-0.m4s"');
  expect(mediaLines).toContain("/api/hls?url=https%3A%2F%2F203.0.113.16%2Fdash%2Ftitle%2Fchunk-0-2.m4s");
  expect(mediaLines.at(-1)).toBe("#EXT-X-ENDLIST");
  // Master and media playlists share one manifest fetch.
  expect(requests).toEqual([{ url: mpd, cookie: "CloudFront-Policy=p" }]);

  const segment = await GET(new NextRequest(new URL(mediaLines.at(-2)!, "https://binje.test")));
  expect(segment.status).toBe(200);
  expect(requests.at(-1)).toEqual({ url: "https://203.0.113.16/dash/title/chunk-0-2.m4s", cookie: "CloudFront-Policy=p" });

  expect((await GET(new NextRequest(`https://binje.test/api/hls?url=${encodeURIComponent(mpd)}&rep=9`))).status).toBe(404);
  expect((await GET(new NextRequest(`https://binje.test/api/hls?url=${encodeURIComponent(mpd)}&rep=../x`))).status).toBe(400);
});

test("rejects DASH manifests it cannot translate", async () => {
  allowStreamHost("https://203.0.113.17/");
  globalThis.fetch = mock(async () => new Response("<html>blocked</html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  const response = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.17/live/index.mpd"));
  expect(response.status).toBe(502);
});
