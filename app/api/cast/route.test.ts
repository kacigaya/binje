import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { isValidCastToken } from "@/lib/cast-token";
import { allowStreamHost } from "@/lib/hls-hosts";
import { POST } from "./route";

const target = "https://198.51.100.140/master.m3u8";
function request(headers: Record<string, string> = {}, body = JSON.stringify({ url: target })) {
  return new NextRequest("https://binje.test/api/cast", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  });
}

describe("POST /api/cast", () => {
  test("issues no-store tokens for validated media and subtitle hosts", async () => {
    allowStreamHost(target);
    allowStreamHost("https://198.51.100.141/en.vtt");
    const response = await POST(request({ origin: "https://binje.test", "sec-fetch-site": "same-origin" },
      JSON.stringify({ url: target, subtitles: ["https://198.51.100.141/en.vtt"] })));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(isValidCastToken(body.token, "binje.test", "198.51.100.140")).toBe(true);
    expect(isValidCastToken(body.token, "binje.test", "198.51.100.141")).toBe(true);
    expect(isValidCastToken(body.token, "other.test", "198.51.100.140")).toBe(false);
  });

  test("rejects cross-origin and originless cross-site requests before parsing", async () => {
    const denied: Record<string, string>[] = [
      { origin: "https://attacker.test", "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "cross-site" },
      { origin: "https://attacker.test" },
    ];
    for (const headers of denied) expect((await POST(request(headers, ""))).status).toBe(403);
  });

  test("issues a host-bound token to an originless native sender", async () => {
    allowStreamHost(target);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(isValidCastToken(body.token, "binje.test", "198.51.100.140")).toBe(true);
    expect(isValidCastToken(body.token, "binje.test", "198.51.100.141")).toBe(false);
  });

  test("requires a JSON target URL and valid subtitle list", async () => {
    for (const body of ["", "{", "null", "[]", "{}", '{"url":1}', '{"url":"https://198.51.100.140/","subtitles":[1]}']) {
      const response = await POST(request({}, body));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect((await POST(request({ "content-type": "text/plain" }))).status).toBe(400);
  });

  test("rejects unsafe, unregistered, and mismatched target hosts", async () => {
    allowStreamHost("http://127.0.0.1/master.m3u8");
    for (const url of ["http://127.0.0.1/master.m3u8", "https://198.51.100.142/master.m3u8", "file:///tmp/video", "https://198.51.100.140:8080/master.m3u8"]) {
      expect((await POST(request({}, JSON.stringify({ url })))).status).toBe(403);
    }
    expect((await POST(request({}, JSON.stringify({ url: target, subtitles: ["http://127.0.0.1/sub.vtt"] })))).status).toBe(403);
  });
});
