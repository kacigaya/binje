import { describe, expect, test } from "bun:test";
import { allowStreamCookie, allowStreamHost, allowStreamHosts, isAllowedStreamHost, streamCookie } from "./hls-hosts";

describe("hls-hosts", () => {
  test("only proxies hosts a resolver handed out", () => {
    expect(isAllowedStreamHost(new URL("https://example.com/evil.html"))).toBe(false);

    allowStreamHost("https://cdn.stream.test/master.m3u8?token=1");
    expect(isAllowedStreamHost(new URL("https://cdn.stream.test/seg/1.ts"))).toBe(true);
    expect(isAllowedStreamHost(new URL("https://other.stream.test/seg/1.ts"))).toBe(false);
  });

  test("keys on host so a different port stays blocked", () => {
    allowStreamHost("https://ported.stream.test:8443/a.m3u8");
    expect(isAllowedStreamHost(new URL("https://ported.stream.test:8443/b.ts"))).toBe(true);
    expect(isAllowedStreamHost(new URL("https://ported.stream.test/b.ts"))).toBe(false);
  });

  test("ignores junk urls and undefined entries", () => {
    allowStreamHosts(["not a url", undefined, "https://tracks.stream.test/en.vtt"]);
    expect(isAllowedStreamHost(new URL("https://tracks.stream.test/en.vtt"))).toBe(true);
  });

  test("sends a scoped cookie only beneath its prefix and allows the host", () => {
    allowStreamCookie("https://signed.stream.test/dash/movie-1/", "CloudFront-Policy=a; CloudFront-Signature=b");
    allowStreamCookie("https://signed.stream.test/dash/movie-1/extra/", "CloudFront-Policy=c");
    allowStreamCookie("not a url", "ignored");

    expect(isAllowedStreamHost(new URL("https://signed.stream.test/dash/movie-1/index.mpd"))).toBe(true);
    expect(streamCookie(new URL("https://signed.stream.test/dash/movie-1/chunk-1.m4s"))).toBe("CloudFront-Policy=a; CloudFront-Signature=b");
    expect(streamCookie(new URL("https://signed.stream.test/dash/movie-1/extra/init.m4s"))).toBe("CloudFront-Policy=c");
    expect(streamCookie(new URL("https://signed.stream.test/dash/movie-10/chunk-1.m4s"))).toBeUndefined();
    expect(streamCookie(new URL("https://signed.stream.test/dash/movie-1"))).toBeUndefined();
    expect(streamCookie(new URL("https://other.stream.test/dash/movie-1/chunk-1.m4s"))).toBeUndefined();
  });

  test("expires scoped cookies after six hours", () => {
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const segment = new URL("https://expiring.stream.test/dash/movie/chunk.m4s");
      allowStreamCookie("https://expiring.stream.test/dash/movie/", "CloudFront-Policy=short-lived");
      expect(streamCookie(segment)).toBe("CloudFront-Policy=short-lived");

      now += 6 * 60 * 60 * 1000 + 1;
      expect(streamCookie(segment)).toBeUndefined();
    } finally {
      Date.now = originalNow;
    }
  });
});
