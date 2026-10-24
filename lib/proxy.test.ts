import { describe, expect, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { bucketFor } from "./rate-limit";

describe("API request limits", () => {
  test.each(["/api/search", "/api/mobile/home"])("returns 429 and Retry-After for %s", async (path) => {
    const clock = spyOn(Date, "now").mockReturnValue(1_800_100_000_000);
    try {
      const request = new NextRequest(`https://binje.test${path}`, {
        headers: { "x-forwarded-for": `proxy-test-${path}` },
      });
      for (let i = 0; i < bucketFor(path)[1]; i++) expect(proxy(request).status).toBe(200);
      clock.mockReturnValue(1_800_100_001_001);
      const response = proxy(request);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("59");
      expect(await response.json()).toEqual({ error: "Too many requests" });
      clock.mockReturnValue(1_800_100_060_001);
      expect(proxy(request).status).toBe(200);
    } finally {
      clock.mockRestore();
    }
  });
});
