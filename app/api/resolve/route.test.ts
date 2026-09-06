import { afterEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { parseVideasyResult, resolveVideasyStream } from "@/lib/videasy";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("parseVideasyResult", () => {
  test("selects Neon HLS and maps subtitles", () => {
    expect(
      parseVideasyResult({
        sources: [
          { url: "https://example.com/video.mpd", type: "dash" },
          { url: "https://example.com/master.m3u8", type: "hls" },
        ],
        subtitles: [
          { url: "https://example.com/en.vtt", language: "English" },
          { url: "https://example.com/fr.vtt", lang: "French" },
          { language: "Broken" },
        ],
      }),
    ).toEqual({
      url: "https://example.com/master.m3u8",
      tracks: [
        { file: "https://example.com/en.vtt", label: "English" },
        { file: "https://example.com/fr.vtt", label: "French" },
      ],
    });
  });

  test("rejects responses without HLS", () => {
    expect(() =>
      parseVideasyResult({
        sources: [{ url: "https://example.com/video.mpd", type: "dash" }],
      }),
    ).toThrow("No playable HLS source.");
  });

  test("prefers 1080p from fixed quality sources", () => {
    expect(
      parseVideasyResult({
        sources: [
          { url: "https://example.com/4k.m3u8", quality: "4K" },
          { url: "https://example.com/1080.m3u8", quality: "1080p" },
          { url: "https://example.com/720.m3u8", quality: "720p" },
        ],
        subtitles: [
          { url: "https://example.com/en-1.vtt", language: "English" },
          { url: "https://example.com/en-2.vtt", language: "English" },
        ],
      }),
    ).toEqual({
      url: "https://example.com/1080.m3u8",
      sources: [
        { file: "https://example.com/4k.m3u8", height: 2160 },
        { file: "https://example.com/1080.m3u8", height: 1080 },
        { file: "https://example.com/720.m3u8", height: 720 },
      ],
      tracks: [{ file: "https://example.com/en-1.vtt", label: "English" }],
    });
  });
});

describe("GET", () => {
  test("rejects missing Videasy metadata", async () => {
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
});

const ENCRYPTED_RESULT =
  "TC8Q0fxV82eu5QP2PWcIhWO1wI5jFul4y53kFE34R7tk-33TTMRpqBtyIlLrU_5wL1wicN8A57XGYPXZRvSpO2bSOBVkhQZCgGqxb4yVvhpcFtCErTJE-PzLFg";
const ENCRYPTED_720P_RESULT =
  "TC8Q0fxV82eu5QP2PWcIhWO1xIluWLou2suqRg_yUKRxoTCcSdpgpEI_JwmoEb1kbUAyMJxBtajWL_rfX6L9aCCAZQt5lA4njjWfNsySogxEGtfK8ho7vw";

test("decrypts the current provider response locally", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/seed?mediaId=550")) {
      return Response.json({ seed: "current-seed" });
    }
    return new Response(ENCRYPTED_RESULT);
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(urls[0]).toBe("https://api.speedracelight.com/seed?mediaId=550");
  expect(urls[1]).toStartWith("https://api.speedracelight.com/cdn/sources-with-title?");
  expect(urls).toHaveLength(2);
});

test("retries a transient CDN failure", async () => {
  let seedAttempts = 0;
  let sourceAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) {
      seedAttempts++;
      return Response.json({ seed: "current-seed" });
    }
    sourceAttempts++;
    return sourceAttempts === 1
      ? new Response(null, { status: 503 })
      : new Response(ENCRYPTED_RESULT);
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(seedAttempts).toBe(1);
  expect(sourceAttempts).toBe(2);
});

test("retries a transient seed failure", async () => {
  let seedAttempts = 0;
  let sourceAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) {
      seedAttempts++;
      return seedAttempts < 3
        ? new Response(null, { status: 503 })
        : Response.json({ seed: "current-seed" });
    }
    sourceAttempts++;
    return new Response(ENCRYPTED_RESULT);
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(seedAttempts).toBe(3);
  expect(sourceAttempts).toBe(1);
});

test("does not retry a permanent CDN failure before falling back", async () => {
  let cdnAttempts = 0;
  let vsrcAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/cdn/")) {
      cdnAttempts++;
      return new Response(null, { status: 404 });
    }
    vsrcAttempts++;
    return new Response(ENCRYPTED_RESULT);
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(cdnAttempts).toBe(1);
  expect(vsrcAttempts).toBe(1);
});

test("upgrades a lower-quality CDN stream with the fallback server", async () => {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    return new Response(url.includes("/cdn/") ? ENCRYPTED_720P_RESULT : ENCRYPTED_RESULT);
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result.url).toBe("https://example.com/video.m3u8");
});

test("rejects when both source servers permanently fail", async () => {
  let sourceAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    if (String(input).includes("/seed?")) return Response.json({ seed: "current-seed" });
    sourceAttempts++;
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;

  await expect(
    resolveVideasyStream({
      type: "movie",
      id: "550",
      title: "Fight Club",
      year: "1999",
      imdbId: "tt0137523",
      season: "1",
      episode: "1",
    }),
  ).rejects.toThrow("Videasy source rejected the request.");
  expect(sourceAttempts).toBe(2);
});

test("rejects a corrupt encrypted provider response", async () => {
  let sourceAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/seed?mediaId=550")) {
      return Response.json({ seed: "current-seed" });
    }
    sourceAttempts++;
    return new Response("not-a-valid-payload");
  }) as unknown as typeof fetch;

  await expect(
    resolveVideasyStream({
      type: "movie",
      id: "550",
      title: "Fight Club",
      year: "1999",
      imdbId: "tt0137523",
      season: "1",
      episode: "1",
    }),
  ).rejects.toThrow("Invalid encrypted Videasy response.");
  expect(sourceAttempts).toBe(2);
});

test("keeps a playable CDN stream when the fallback server fails", async () => {
  let vsrcAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/cdn/")) return new Response(ENCRYPTED_720P_RESULT);
    vsrcAttempts++;
    return new Response(null, { status: 503 });
  }) as unknown as typeof fetch;

  const result = await resolveVideasyStream({
    type: "movie",
    id: "550",
    title: "Fight Club",
    year: "1999",
    imdbId: "tt0137523",
    season: "1",
    episode: "1",
  });

  expect(result).toEqual({
    url: "https://example.com/720.m3u8",
    tracks: [],
    sources: [{ file: "https://example.com/720.m3u8", height: 720 }],
  });
  expect(vsrcAttempts).toBe(3);
});

test("rejects unknown playback sources", async () => {
  const response = await GET(new NextRequest("https://binje.test/api/resolve?source=unknown&type=movie&id=278&title=Movie&year=1994"));
  expect(response.status).toBe(400);
});

test("dispatches VidZee and keeps upstream headers server-side", async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => Response.json(
    String(input).includes("/subs/") ? [] : { url: "https://cdn.test/new-stream", headers: { Referer: "https://provider.test/" } },
  )) as unknown as typeof fetch;
  const response = await GET(new NextRequest("https://binje.test/api/resolve?source=vidzee&type=movie&id=987654&title=Movie&year=1994"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ url: "https://cdn.test/new-stream", tracks: [] });
});
