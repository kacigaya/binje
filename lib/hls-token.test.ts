import { afterEach, expect, test } from "bun:test";
import {
  isSignedProxyRequest,
  proxyResolverPayload,
  proxyUrl,
} from "./hls-token";

const ORIGIN = "https://binje.test";
const TARGET = "https://cdn.example.com/library/master.m3u8?token=abc";

const original = process.env.HLS_SIGNING_SECRET;
process.env.HLS_SIGNING_SECRET = "test-secret";
afterEach(() => {
  process.env.HLS_SIGNING_SECRET = original ?? "test-secret";
});

function parts(signed: string) {
  const url = new URL(signed);
  return {
    target: url.searchParams.get("url")!,
    exp: url.searchParams.get("exp"),
    sig: url.searchParams.get("sig"),
  };
}

test("a freshly minted proxy URL verifies", async () => {
  const { target, exp, sig } = parts(await proxyUrl(ORIGIN, TARGET));
  expect(target).toBe(TARGET);
  expect(await isSignedProxyRequest(target, exp, sig)).toBe(true);
});

test("a tampered target is rejected", async () => {
  const { exp, sig } = parts(await proxyUrl(ORIGIN, TARGET));
  expect(
    await isSignedProxyRequest("https://evil.example.com/a.m3u8", exp, sig),
  ).toBe(false);
});

test("an extended expiry is rejected", async () => {
  const { target, exp, sig } = parts(await proxyUrl(ORIGIN, TARGET));
  expect(await isSignedProxyRequest(target, String(Number(exp) + 60), sig)).toBe(
    false,
  );
});

test("an expired signature is rejected", async () => {
  const now = Date.now();
  const { target, exp, sig } = parts(await proxyUrl(ORIGIN, TARGET, now));
  const afterExpiry = now + 7 * 60 * 60 * 1000;
  expect(await isSignedProxyRequest(target, exp, sig, afterExpiry)).toBe(false);
});

test("missing signature parameters are rejected", async () => {
  expect(await isSignedProxyRequest(TARGET, null, null)).toBe(false);
});

test("without a secret nothing is signed and nothing verifies", async () => {
  delete process.env.HLS_SIGNING_SECRET;
  delete process.env.STORAGE_SECRET_ACCESS_KEY;
  const previousTmdb = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;

  const { target, exp, sig } = parts(await proxyUrl(ORIGIN, TARGET));
  expect(exp).toBeNull();
  expect(sig).toBeNull();
  expect(await isSignedProxyRequest(target, "1", "deadbeef")).toBe(false);

  if (previousTmdb !== undefined) process.env.TMDB_API_KEY = previousTmdb;
});

test("resolver payloads come back fully proxied", async () => {
  const payload = await proxyResolverPayload(ORIGIN, {
    url: TARGET,
    tracks: [{ file: "https://cdn.example.com/en.vtt", label: "English" }],
    sources: [{ file: "https://cdn.example.com/720p.m3u8", height: 720 }],
  });

  for (const value of [payload.url, payload.tracks[0].file, payload.sources[0].file]) {
    const url = new URL(value);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/api/hls");
    expect(await isSignedProxyRequest(url.searchParams.get("url")!, url.searchParams.get("exp"), url.searchParams.get("sig"))).toBe(true);
  }
  expect(payload.tracks[0].label).toBe("English");
  expect(payload.sources[0].height).toBe(720);
});
