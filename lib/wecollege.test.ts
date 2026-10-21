import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  clearWeCollegeCache,
  dedupeTracks,
  decryptWeCollegePayload,
  parseWeCollegeResult,
  qualityHeight,
  resolveWeCollegeStream,
  subtitleLabel,
} from "@/lib/wecollege";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearWeCollegeCache();
});

const PARAMS = {
  type: "movie" as const,
  id: "550",
  title: "Fight Club",
  year: "1999",
  imdbId: "tt0137523",
  season: "1",
  episode: "1",
};

// The provider encrypts with the same cipher the Movy player uses.
const ENCRYPTED = [
  "TC8Q0fxV82eu5QP2PWcIhWO1wI5jFul4y53kFE34R7tk-33TTMRpqBtyIlLrU_5wL1wicN8A57XGYPXZRvSpO2bSOBVkhQZCgGqxb4yVvhpcFtCErTJE-PzLFg",
];

describe("parseWeCollegeResult", () => {
  test("maps sources and subtitles", () => {
    expect(
      parseWeCollegeResult({
        sources: [
          { quality: "2160p", url: "https://example.com/2160.m3u8" },
          { quality: "1080p", url: "https://example.com/1080.m3u8" },
          { quality: "1080p", url: "javascript:alert(1)" },
        ],
        subtitles: [
          { language: "English - [Eng] 2", url: "https://example.com/en.vtt", type: "vtt" },
          { lang: "French", url: "https://example.com/fr.vtt", type: "vtt" },
          { language: "Broken" },
        ],
      }),
    ).toEqual({
      sources: [
        { quality: "2160p", url: "https://example.com/2160.m3u8" },
        { quality: "1080p", url: "https://example.com/1080.m3u8" },
      ],
      tracks: [
        { file: "https://example.com/en.vtt", label: "English" },
        { file: "https://example.com/fr.vtt", label: "French" },
      ],
    });
  });

  test("rejects responses without sources", () => {
    expect(() => parseWeCollegeResult({ subtitles: [] })).toThrow("Invalid WeCollege response.");
  });
});

describe("qualityHeight", () => {
  test("reads the labelled rendition and ignores adaptive playlists", () => {
    expect(qualityHeight("2160p")).toBe(2160);
    expect(qualityHeight("1080p")).toBe(1080);
    expect(qualityHeight("Auto")).toBe(0);
  });
});

describe("subtitleLabel", () => {
  test("keeps the language and drops the code and index", () => {
    expect(subtitleLabel("English - [Eng] 2")).toBe("English");
    expect(subtitleLabel("English - Sdh [Eng] 3")).toBe("English SDH");
    expect(subtitleLabel("Bulgarian - [Bul] 7")).toBe("Bulgarian");
  });
});

describe("dedupeTracks", () => {
  test("keeps one track per language", () => {
    expect(
      dedupeTracks([
        { file: "https://example.com/en-1.vtt", label: "English" },
        { file: "https://example.com/en-2.vtt", label: "English" },
        { file: "https://example.com/en-sdh.vtt", label: "English SDH" },
      ]),
    ).toEqual([
      { file: "https://example.com/en-1.vtt", label: "English" },
      { file: "https://example.com/en-sdh.vtt", label: "English SDH" },
    ]);
  });
});

test("decrypts the provider response locally", () => {
  expect(decryptWeCollegePayload(ENCRYPTED[0], "current-seed", "550")).toEqual({
    sources: [{ quality: "1080p", url: "https://example.com/video.m3u8" }],
    subtitles: [],
  });
});

test("rejects a corrupt encrypted response", () => {
  expect(() => decryptWeCollegePayload("not-a-valid-payload", "current-seed", "550")).toThrow(
    "Invalid encrypted WeCollege response.",
  );
});

const MEDIA_PLAYLIST = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:6", "#EXT-X-ENDLIST", "#EXTINF:6.000,", "https://example.com/seg.m4s"].join("\n");

test("resolves the tallest playable rendition with its tracks", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/sources?")) return new Response(ENCRYPTED[0]);
    return new Response(MEDIA_PLAYLIST);
  }) as unknown as typeof fetch;

  const result = await resolveWeCollegeStream(PARAMS);

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(result.sources).toEqual([{ file: "https://example.com/video.m3u8", height: 1080 }]);
  expect(result.referer).toBe("https://www.movy.sx/");
  expect(urls[0]).toBe("https://api.wecollege.net/seed?mediaId=550");
  expect(urls[1]).toContain("https://api.wecollege.net/miami/sources?");
  expect(urls[1]).toContain("enc=2");
});

test("asks for the season and episode of a show", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/seed?")) return Response.json({ seed: "current-seed" });
    if (url.includes("/sources?")) return new Response(ENCRYPTED[0]);
    return new Response(MEDIA_PLAYLIST);
  }) as unknown as typeof fetch;

  await resolveWeCollegeStream({ ...PARAMS, type: "tv", season: "2", episode: "5" });

  expect(urls[1]).toContain("seasonId=2");
  expect(urls[1]).toContain("episodeId=5");
});

test("refreshes a seed the provider rejects", async () => {
  let seedAttempts = 0;
  let sourceAttempts = 0;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/seed?")) {
      seedAttempts++;
      return Response.json({ seed: "current-seed" });
    }
    if (url.includes("/sources?")) {
      sourceAttempts++;
      return sourceAttempts === 1
        ? new Response(null, { status: 401 })
        : new Response(ENCRYPTED[0]);
    }
    return new Response(MEDIA_PLAYLIST);
  }) as unknown as typeof fetch;

  const result = await resolveWeCollegeStream(PARAMS);

  expect(result.url).toBe("https://example.com/video.m3u8");
  expect(seedAttempts).toBe(2);
});

test("stops when the provider rate limits the seed", async () => {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    if (String(input).includes("/seed?")) return new Response(null, { status: 429 });
    return new Response(ENCRYPTED[0]);
  }) as unknown as typeof fetch;

  await expect(resolveWeCollegeStream(PARAMS)).rejects.toThrow("WeCollege seed is rate limited.");
});
