import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { isValidCastToken } from "@/lib/cast-token";
import { POST } from "./route";

describe("POST /api/cast", () => {
  test("issues a no-store token to the same origin", async () => {
    const response = POST(
      new NextRequest("https://binje.test/api/cast", {
        method: "POST",
        headers: {
          host: "binje.test",
          origin: "https://binje.test",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    const body = (await response.json()) as { token: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(isValidCastToken(body.token)).toBe(true);
  });

  test("rejects cross-origin token requests", () => {
    const response = POST(
      new NextRequest("https://binje.test/api/cast", {
        method: "POST",
        headers: {
          host: "binje.test",
          origin: "https://attacker.test",
          "sec-fetch-site": "cross-site",
        },
      }),
    );

    expect(response.status).toBe(403);
  });
});
