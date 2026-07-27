import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const TARGET = "https://cdn.example.com/master.m3u8";

function request(query: string) {
  return new NextRequest(`http://localhost/api/hls?${query}`);
}

describe("GET", () => {
  test("rejects a non-HTTP target", async () => {
    const response = await GET(request("url=file:///etc/passwd"));
    expect(response.status).toBe(400);
  });

  test("refuses an unsigned target without touching the network", async () => {
    const response = await GET(
      request(`url=${encodeURIComponent(TARGET)}`),
    );
    expect(response.status).toBe(403);
  });

  test("refuses a forged signature", async () => {
    const response = await GET(
      request(
        `url=${encodeURIComponent(TARGET)}&exp=${Math.floor(Date.now() / 1000) + 600}&sig=deadbeef`,
      ),
    );
    expect(response.status).toBe(403);
  });
});
