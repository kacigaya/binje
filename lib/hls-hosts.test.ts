import { describe, expect, test } from "bun:test";
import { allowStreamHost, allowStreamHosts, isAllowedStreamHost } from "./hls-hosts";

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
});
