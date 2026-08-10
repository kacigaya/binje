import { describe, expect, test } from "bun:test";
import { bucketFor, clientIp, isRateLimited } from "./rate-limit";

describe("rate-limit", () => {
  test("buckets routes by upstream cost", () => {
    expect(bucketFor("/api/hls?url=x")[1]).toBe(600);
    expect(bucketFor("/api/resolve-vf")[0]).toBe("/api/resolve");
    expect(bucketFor("/api/search")[1]).toBe(bucketFor("/api/mobile/home")[1]);
  });

  test("blocks past the bucket limit and keeps buckets independent", () => {
    const ip = "203.0.113.9";
    const [, max] = bucketFor("/api/resolve");
    for (let i = 0; i < max; i++) {
      expect(isRateLimited(ip, "/api/resolve")).toBe(false);
    }
    expect(isRateLimited(ip, "/api/resolve")).toBe(true);
    expect(isRateLimited(ip, "/api/search")).toBe(false);
    expect(isRateLimited("203.0.113.10", "/api/resolve")).toBe(false);
  });

  test("uses the proxy-appended x-forwarded-for entry and ignores spoofable headers", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "198.51.100.1",
      "x-forwarded-for": "198.51.100.2, 203.0.113.7",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers({ "x-nf-client-connection-ip": "198.51.100.1" }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
