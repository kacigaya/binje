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

test("sends no Referer or Origin to a host pinned with an empty referer", async () => {
  allowStreamHost("https://203.0.113.19/movie/1.m3u8", "");
  const seen: Headers[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return new Response("#EXTM3U\nhttps://203.0.113.20/v/index.m3u8\n", {
      headers: { "content-type": "application/vnd.apple.mpegurl" },
    });
  }) as unknown as typeof fetch;
  const result = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.19/movie/1.m3u8"));
  expect(result.status).toBe(200);
  const child = new URL((await result.text()).trim().split("\n")[1], "https://binje.test");
  await GET(new NextRequest(child));
  expect(seen.map((headers) => [headers.get("referer"), headers.get("origin")])).toEqual([
    [null, null],
    [null, null],
  ]);
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

test("rewrites playlists served as text and forwards the viewer's User-Agent to children", async () => {
  allowStreamHost("https://203.0.113.20/master.txt", "https://player.test/e/1");
  const agents: (string | null)[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    agents.push(new Headers(init?.headers).get("user-agent"));
    return new Response("#EXTM3U\n#EXTINF:4,\nhttps://203.0.113.21/seg-1.ts\n", { headers: { "content-type": "text/plain" } });
  }) as unknown as typeof fetch;
  const request = new NextRequest("https://binje.test/api/hls?url=https://203.0.113.20/master.txt", {
    headers: { "user-agent": "Viewer/2.0" },
  });
  const result = await GET(request);
  expect(result.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
  const child = new URL((await result.text()).trim().split("\n")[2], "https://binje.test");
  await GET(new NextRequest(child, { headers: { "user-agent": "Viewer/2.0" } }));
  expect(agents).toEqual(["Viewer/2.0", "Viewer/2.0"]);
});

test("serves segments disguised as images as MPEG-TS and passes subtitles through", async () => {
  allowStreamHost("https://203.0.113.22/");
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0];
  const ts = Array.from({ length: 376 }, (_, index) => (index % 188 === 0 ? 0x47 : 1));
  globalThis.fetch = mock(async (input: unknown) => String(input).endsWith(".vtt")
    ? new Response("WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n", { headers: { "content-type": "text/vtt" } })
    : new Response(new Uint8Array([...png, ...ts]), { headers: { "content-type": "image/png" } })) as unknown as typeof fetch;

  const segment = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.22/seg.image"));
  expect(segment.headers.get("content-type")).toBe("video/mp2t");
  expect(Array.from(new Uint8Array(await segment.arrayBuffer()))).toEqual(ts);

  const subtitles = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.22/en.vtt"));
  expect(subtitles.status).toBe(200);
  expect(subtitles.headers.get("content-type")).toBe("text/vtt");
  expect(await subtitles.text()).toStartWith("WEBVTT");
});

test("serves SRT files marked format=srt as WebVTT and rejects failed ones", async () => {
  allowStreamHost("https://203.0.113.21/file/1");
  const request = new NextRequest("https://binje.test/api/hls?url=https://203.0.113.21/file/1&format=srt");
  globalThis.fetch = mock(async () => new Response("1\r\n00:00:01,000 --> 00:00:02,500\r\nHi\r\n", {
    headers: { "content-type": "application/octet-stream" },
  })) as unknown as typeof fetch;
  const response = await GET(request);
  expect(response.headers.get("content-type")).toBe("text/vtt; charset=utf-8");
  expect(await response.text()).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHi\n");
  globalThis.fetch = mock(async () => new Response("gone", { status: 404 })) as unknown as typeof fetch;
  expect((await GET(request)).status).toBe(502);
});

test("fetches SRT whole and stops reading past the size limit", async () => {
  allowStreamHost("https://203.0.113.22/file/1");
  const url = "https://binje.test/api/hls?url=https://203.0.113.22/file/1&format=srt";
  let sentRange: string | null = "unset";
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    sentRange = new Headers(init?.headers).get("range");
    return new Response("1\n00:00:01,000 --> 00:00:02,000\nHi\n");
  }) as unknown as typeof fetch;
  const ranged = await GET(new NextRequest(url, { headers: { range: "bytes=0-10" } }));
  expect(sentRange).toBeNull();
  expect(await ranged.text()).toStartWith("WEBVTT");

  // No content-length: the limit applies while reading.
  const chunk = new Uint8Array(1024 * 1024);
  // Extensionless octet-stream subtitles must reach the read limit before DASH sniffing buffers them.
  globalThis.fetch = mock(async () => new Response(new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
    },
  }), { headers: { "content-type": "application/octet-stream" } })) as unknown as typeof fetch;
  expect((await GET(new NextRequest(url))).status).toBe(502);
});

test("gives up on an SRT body that stalls after its headers", async () => {
  allowStreamHost("https://203.0.113.23/file/1");
  const realSetTimeout = globalThis.setTimeout;
  // Run the read deadline at once instead of after the real timeout.
  globalThis.setTimeout = ((handler: () => void) => realSetTimeout(handler, 0)) as typeof setTimeout;
  try {
    globalThis.fetch = mock(async () => new Response(new ReadableStream({ pull: () => new Promise(() => {}) }))) as unknown as typeof fetch;
    const response = await GET(new NextRequest("https://binje.test/api/hls?url=https://203.0.113.23/file/1&format=srt"));
    expect(response.status).toBe(502);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});
