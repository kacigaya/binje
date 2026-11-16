import { afterEach, expect, mock, test } from "bun:test";
import { resolveVidcoreStream } from "./vidcore";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.VIDCORE_RESOLVER_URL;
const originalToken = process.env.VIDCORE_RESOLVER_TOKEN;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.VIDCORE_RESOLVER_URL;
  else process.env.VIDCORE_RESOLVER_URL = originalUrl;
  if (originalToken === undefined) delete process.env.VIDCORE_RESOLVER_TOKEN;
  else process.env.VIDCORE_RESOLVER_TOKEN = originalToken;
});

const params = (id: string) => ({ type: "movie" as const, id, title: "Movie", year: "2026", imdbId: "", season: "1", episode: "1" });

function configure() {
  process.env.VIDCORE_RESOLVER_URL = "http://127.0.0.1:3040";
  process.env.VIDCORE_RESOLVER_TOKEN = "local-service-token";
}

test("fails promptly when the browser service is not configured", async () => {
  delete process.env.VIDCORE_RESOLVER_URL;
  await expect(resolveVidcoreStream(params("1"))).rejects.toThrow("not configured");
});

test("uses the authenticated service, probes HLS and shares concurrent resolves", async () => {
  configure();
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  globalThis.fetch = mock(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers), body: init?.body });
    if (url.startsWith("http://127.0.0.1:3040/")) return Response.json({ url: "https://203.0.113.150/master.m3u8" });
    if (url.endsWith("master.m3u8")) return new Response("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=3840x1600\n4k.m3u8\n");
    if (url.endsWith("4k.m3u8")) return new Response("#EXTM3U\n#EXTINF:150,\nsegment.ts\n#EXT-X-ENDLIST\n");
    return new Response("segment");
  }) as unknown as typeof fetch;
  const input = { ...params("2"), type: "tv" as const, season: "3", episode: "4" };
  const [first, second] = await Promise.all([resolveVidcoreStream(input), resolveVidcoreStream(input)]);
  expect(first).toEqual({ url: "https://203.0.113.150/master.m3u8", referer: "https://vidcore.io/", tracks: [], height: 2160 });
  expect(second).toEqual(first);
  expect(calls.filter((call) => call.url.includes("3040"))).toHaveLength(1);
  expect(calls[0].headers.get("authorization")).toBe("Bearer local-service-token");
  expect(JSON.parse(String(calls[0].body))).toEqual({ type: "tv", id: "2", season: "3", episode: "4" });
  expect(calls.slice(1).every((call) => !call.headers.has("authorization") && call.headers.get("referer") === "https://vidcore.io/")).toBe(true);
});

test("rejects private media targets before making a request", async () => {
  configure();
  const fetcher = mock(async () => Response.json({ url: "http://169.254.169.254/latest/meta-data" }));
  globalThis.fetch = fetcher as unknown as typeof fetch;
  await expect(resolveVidcoreStream(params("3"))).rejects.toThrow("no playable stream");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("rejects service errors and evicts failed resolves", async () => {
  configure();
  const fetcher = mock(async () => new Response("failed", { status: 502 }));
  globalThis.fetch = fetcher as unknown as typeof fetch;
  await expect(resolveVidcoreStream(params("4"))).rejects.toThrow("resolver failed");
  await expect(resolveVidcoreStream(params("4"))).rejects.toThrow("resolver failed");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("rejects malformed media URLs", async () => {
  configure();
  globalThis.fetch = mock(async () => Response.json({ url: "javascript:alert(1)" })) as unknown as typeof fetch;
  await expect(resolveVidcoreStream(params("5"))).rejects.toThrow("no playable stream");
});
