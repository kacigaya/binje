import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  canonicalString,
  clearMovieboxSession,
  dashManifestFromSignCookie,
  pickSubject,
  resolveMovieboxStream,
  signedHeaders,
} from "./moviebox";

const originalFetch = globalThis.fetch;
const SECRET = Buffer.from("76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O", "base64");
const SCOPE = "https://sacdn.test/dash/123_0_0_1080_h265_1/";

function cloudFrontCookie(resource = `${SCOPE}*`) {
  const policy = Buffer.from(JSON.stringify({ Statement: [{ Resource: resource }] }))
    .toString("base64").replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");
  return `CloudFront-Policy=${policy};CloudFront-Signature=sig;CloudFront-Key-Pair-Id=KEY;`;
}

function jwt(exp: number) {
  return `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
}

type Call = { url: string; method: string; headers: Headers; body?: string };
function mockApi(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as unknown as typeof fetch;
  return calls;
}

function api(call: Call, subjects: object[] = [], streams: object[] = [], captions: object[] = []) {
  if (call.url.includes("/visitor-login")) return Response.json({ code: 0, data: { token: jwt(Math.floor(Date.now() / 1000) + 3600) } });
  if (call.url.includes("/search/v2")) return Response.json({ code: 0, data: { results: [{ subjects }] } });
  if (call.url.includes("/play-info/v2")) return Response.json({ code: 0, data: { streams } });
  if (call.url.includes("/get-ext-captions")) return Response.json({ code: 0, data: { extCaptions: captions } });
  return new Response(null, { status: 404 });
}

beforeEach(() => clearMovieboxSession());
afterEach(() => { globalThis.fetch = originalFetch; });

test("signs requests the way the Android client does", () => {
  const url = "https://api6.aoneroom.com/wefeed-mobile-bff/subject-api/get?b=2&a=1";
  expect(canonicalString("get", url, undefined, 1700000000000)).toBe(
    "GET\napplication/json\napplication/json\n\n1700000000000\n\n/wefeed-mobile-bff/subject-api/get?a=1&b=2",
  );
  expect(canonicalString("POST", "https://api6.aoneroom.com/x", "{}", 1)).toBe(
    "POST\napplication/json\napplication/json\n2\n1\n99914b932bd37a50b983c5e7c90ae93b\n/x",
  );

  const headers = signedHeaders("GET", url, undefined, "tok", 1700000000000);
  const expected = createHmac("md5", SECRET).update(canonicalString("GET", url, undefined, 1700000000000)).digest("base64");
  expect(headers["x-tr-signature"]).toBe(`1700000000000|2|${expected}`);
  expect(headers["x-client-token"]).toMatch(/^1700000000000,[0-9a-f]{32}$/);
  expect(headers.authorization).toBe("Bearer tok");
  expect(JSON.parse(headers["x-client-info"]).package_name).toBe("com.community.oneroom");
  expect(headers["x-forwarded-for"]).toBeUndefined();
});

test("derives the DASH manifest and cookie scope from the signed policy", () => {
  expect(dashManifestFromSignCookie(cloudFrontCookie())).toEqual({
    url: `${SCOPE}index.mpd`,
    cookie: expect.stringMatching(/^CloudFront-Policy=.+; CloudFront-Signature=sig; CloudFront-Key-Pair-Id=KEY$/),
    scope: SCOPE,
  });
  expect(dashManifestFromSignCookie(cloudFrontCookie("http://sacdn.test/dash/1/*"))).toBeUndefined();
  expect(dashManifestFromSignCookie("CloudFront-Signature=sig")).toBeUndefined();
  expect(dashManifestFromSignCookie(undefined)).toBeUndefined();
});

test("prefers the plain title over dubbed uploads and matches type and year", () => {
  const subjects = [
    { subjectId: "1", title: "Inception [Hindi]", subjectType: 1, releaseDate: "2010-09-01" },
    { subjectId: "2", title: "Inception", subjectType: 2, releaseDate: "2010-07-16" },
    { subjectId: "3", title: "Inception", subjectType: 1, releaseDate: "2010-07-16" },
    { subjectId: "4", title: "Inception (2010)", subjectType: 1, releaseDate: "1999-01-01" },
  ];
  expect(pickSubject(subjects, { type: "movie", title: "Inception", year: "2010" })?.subjectId).toBe("3");
  expect(pickSubject(subjects, { type: "tv", title: "Inception", year: "2010" })?.subjectId).toBe("2");
  expect(pickSubject(subjects.slice(0, 1), { type: "movie", title: "Inception", year: "2010" })?.subjectId).toBe("1");
  expect(pickSubject(subjects, { type: "movie", title: "Interstellar", year: "2014" })).toBeUndefined();
  expect(pickSubject([{ subjectId: "5", title: "Amélie", subjectType: 1 }], { type: "movie", title: "Amelie!", year: "2001" })?.subjectId).toBe("5");
});

test("resolves a TV episode to the signed manifest and filters captions", async () => {
  const calls = mockApi((call) => api(
    call,
    [{ subjectId: "77", title: "Breaking Bad", subjectType: 2, releaseDate: "2008-01-20" }],
    [{ id: 9, url: "https://macdn.aoneroom.com/other/notice.mp4", signCookie: cloudFrontCookie() }],
    [
      { url: "https://subs.test/en.vtt", lanName: "English", size: 4000 },
      { url: "https://subs.test/fr.srt", lanName: "French", size: 4000 },
      { url: "https://subs.test/empty.vtt", lan: "de", size: 20 },
      { url: "http://subs.test/plain.vtt", lan: "es", size: 4000 },
    ],
  ));
  const result = await resolveMovieboxStream({ type: "tv", id: "1396", title: "Breaking Bad", year: "2008", season: "1", episode: "2" });
  expect(result).toEqual({
    url: `${SCOPE}index.mpd`,
    tracks: [{ file: "https://subs.test/en.vtt", label: "English" }],
    cookie: expect.stringContaining("CloudFront-Signature=sig"),
    cookieScope: SCOPE,
  });
  expect(calls.map((call) => call.url)).toEqual([
    "https://api6.aoneroom.com/wefeed-mobile-bff/user-api/visitor-login",
    "https://api6.aoneroom.com/wefeed-mobile-bff/subject-api/search/v2",
    "https://api6.aoneroom.com/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=77&se=1&ep=2",
    "https://api6.aoneroom.com/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=77&resourceId=9",
  ]);
  expect(calls[1].body).toBe(JSON.stringify({ keyword: "Breaking Bad", page: 1, perPage: 15, subjectType: 0 }));
  expect(calls[2].headers.get("authorization")).toMatch(/^Bearer h\./);
});

test("ignores the placeholder stream url and rejects titles MovieBox lacks", async () => {
  mockApi((call) => api(
    call,
    [{ subjectId: "1", title: "Movie", subjectType: 1 }],
    [{ id: 1, url: "https://macdn.aoneroom.com/other/notice.mp4", signCookie: "" }],
  ));
  await expect(resolveMovieboxStream({ type: "movie", id: "201", title: "Movie", year: "2001", season: "1", episode: "1" })).rejects.toThrow("No MovieBox stream.");
  await expect(resolveMovieboxStream({ type: "movie", id: "202", title: "Other", year: "2001", season: "1", episode: "1" })).rejects.toThrow("Not on MovieBox.");
});

test("re-logs in once when the session is rejected", async () => {
  let logins = 0;
  const calls = mockApi((call) => {
    if (call.url.includes("/visitor-login")) logins++;
    // The first session is rejected by every host; the second one is accepted.
    if (call.url.includes("/search/v2") && logins < 2) return new Response(null, { status: 403 });
    return api(call, [{ subjectId: "3", title: "Movie", subjectType: 1 }], [{ id: 1, signCookie: cloudFrontCookie() }]);
  });
  const result = await resolveMovieboxStream({ type: "movie", id: "203", title: "Movie", year: "2001", season: "1", episode: "1" });
  expect(result.url).toBe(`${SCOPE}index.mpd`);
  expect(logins).toBe(2);
  expect(calls.filter((call) => call.url.includes("/search/v2"))).toHaveLength(8);
});

test("falls back to the next host and tolerates caption failures", async () => {
  const calls = mockApi((call) => {
    if (call.url.startsWith("https://api6.aoneroom.com/")) return new Response(null, { status: 503 });
    if (call.url.includes("/get-ext-captions")) return new Response(null, { status: 500 });
    return api(call, [{ subjectId: "4", title: "Movie", subjectType: 1 }], [{ id: 1, signCookie: cloudFrontCookie() }]);
  });
  const result = await resolveMovieboxStream({ type: "movie", id: "204", title: "Movie", year: "2001", season: "1", episode: "1" });
  expect(result.tracks).toEqual([]);
  expect(calls.some((call) => call.url.startsWith("https://api5.aoneroom.com/"))).toBe(true);
});

test("rejects invalid params before any request", async () => {
  const calls = mockApi((call) => api(call));
  await expect(resolveMovieboxStream({ type: "movie", id: "abc", title: "Movie", year: "2001", season: "1", episode: "1" })).rejects.toThrow("Invalid media.");
  await expect(resolveMovieboxStream({ type: "tv", id: "1", title: "Movie", year: "2001", season: "0", episode: "1" })).rejects.toThrow("Invalid media.");
  await expect(resolveMovieboxStream({ type: "movie", id: "1", title: "", year: "2001", season: "1", episode: "1" })).rejects.toThrow("Invalid media.");
  expect(calls).toHaveLength(0);
});
