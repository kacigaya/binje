import { describe, expect, test } from "bun:test";
import { createCastToken, isValidCastToken } from "./cast-token";

describe("cast-token", () => {
  test("creates an unguessable token accepted by the media proxy", () => {
    const token = createCastToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isValidCastToken(token)).toBe(true);
  });

  test("rejects missing, malformed, and unknown tokens", () => {
    expect(isValidCastToken(null)).toBe(false);
    expect(isValidCastToken("too-short")).toBe(false);
    expect(isValidCastToken("a".repeat(32))).toBe(false);
  });
});
