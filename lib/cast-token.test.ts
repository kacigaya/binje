import { describe, expect, spyOn, test } from "bun:test";
import { allowCastHost, createCastToken, isValidCastToken } from "./cast-token";

describe("cast-token", () => {
  test("binds unguessable tokens to sender and target hosts", () => {
    const token = createCastToken("binje.test", ["cdn.test", "subs.test"]);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isValidCastToken(token, "binje.test", "cdn.test")).toBe(true);
    expect(isValidCastToken(token, "binje.test", "subs.test")).toBe(true);
    expect(isValidCastToken(token, "other.test", "cdn.test")).toBe(false);
    expect(isValidCastToken(token, "binje.test", "cdn.test:8080")).toBe(false);
    expect(isValidCastToken(token, "binje.test", "other.test")).toBe(false);
    for (const invalid of [null, "too-short", "a".repeat(32)]) {
      expect(isValidCastToken(invalid, "binje.test", "cdn.test")).toBe(false);
    }
  });

  test("expires at five minutes without extending lifetime on use or child authorization", () => {
    const clock = spyOn(Date, "now").mockReturnValue(1_800_200_000_000);
    try {
      const token = createCastToken("binje.test", ["cdn.test"]);
      clock.mockReturnValue(1_800_200_299_999);
      expect(isValidCastToken(token, "binje.test", "cdn.test")).toBe(true);
      expect(allowCastHost(token, "binje.test", "cdn.test", "segment.test")).toBe(true);
      clock.mockReturnValue(1_800_200_300_000);
      expect(isValidCastToken(token, "binje.test", "cdn.test")).toBe(false);
      expect(isValidCastToken(token, "binje.test", "segment.test")).toBe(false);
      expect(allowCastHost(token, "binje.test", "cdn.test", "another.test")).toBe(false);
    } finally { clock.mockRestore(); }
  });

  test("extends scope only from an authorized parent and sender", () => {
    const token = createCastToken("binje.test", ["cdn.test"]);
    expect(allowCastHost(token, "other.test", "cdn.test", "segment.test")).toBe(false);
    expect(allowCastHost(token, "binje.test", "unrelated.test", "segment.test")).toBe(false);
    expect(isValidCastToken(token, "binje.test", "segment.test")).toBe(false);
    expect(allowCastHost(token, "binje.test", "cdn.test", "segment.test")).toBe(true);
    expect(isValidCastToken(token, "binje.test", "segment.test")).toBe(true);
  });
});
