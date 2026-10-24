import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import nextConfig from "../next.config";
import { proxy } from "../proxy";
import { API_CSP, PAGE_CSP } from "./security-headers";

function configuredHeaders(url: string) {
  const result = spawnSync(process.execPath, ["--eval", `
    await import("next/dist/server/node-environment-baseline");
    const { unstable_getResponseFromNextConfig } = await import("next/experimental/testing/server");
    const { default: nextConfig } = await import("./next.config");
    const response = await unstable_getResponseFromNextConfig({ url: process.argv[1], nextConfig });
    console.log(JSON.stringify([...response.headers]));
  `, url], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  expect(result.status).toBe(0);
  return new Headers(JSON.parse(result.stdout));
}

describe("response CSP", () => {
  test("sets HSTS for subdomains without preload and disables the framework header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    for (const path of ["/en", "/api/hls"]) {
      const headers = configuredHeaders(`https://binje.test${path}`);
      expect(headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
      expect(headers.get("x-powered-by")).toBeNull();
    }
  });

  test("publishes a security contact with a canonical URL and expiry within one year", () => {
    const content = readFileSync(new URL("../public/.well-known/security.txt", import.meta.url), "utf8");
    const fields = new Map(content.trim().split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon), line.slice(colon + 1).trim()];
    }));
    expect(new URL(fields.get("Contact")!).protocol).toBe("https:");
    expect(fields.get("Preferred-Languages")).toBe("en, fr");
    expect(fields.get("Canonical")).toBe("https://binje.duckdns.org/.well-known/security.txt");
    const expires = Date.parse(fields.get("Expires")!);
    const issued = Date.UTC(2026, 9, 24);
    expect(expires).toBeGreaterThan(issued);
    expect(expires - issued).toBeLessThanOrEqual(365 * 24 * 60 * 60 * 1000);
  });

  test.each(["search", "resolve", "sources", "episodes", "mobile/home"])(
    "omits anonymous CORS on /api/%s", (path) => {
      const url = `https://binje.test/api/${path}`;
      expect(configuredHeaders(url).get("access-control-allow-origin")).toBeNull();
      expect(proxy(new NextRequest(url, { headers: { origin: "https://attacker.test" } })).headers.get("access-control-allow-origin")).toBeNull();
    },
  );

  test("keeps the restrictive HLS CSP through configured headers and proxy", async () => {
    const url = "https://binje.test/api/hls";
    const response = new Response("segment", { headers: { "content-security-policy": API_CSP } });
    for (const source of [configuredHeaders(url), proxy(new NextRequest(url)).headers]) {
      for (const [key, value] of source) response.headers.set(key, value);
    }
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test.each(["/en", "/fr/movie/1", "/"]) ("keeps the page CSP on %s", (path) => {
    const url = `https://binje.test${path}`;
    expect(configuredHeaders(url).get("content-security-policy")).toBeNull();
    const response = proxy(new NextRequest(url));
    expect(response.headers.get("content-security-policy")).toBe(PAGE_CSP);
    expect(PAGE_CSP).toContain("frame-ancestors 'self'");
    expect(PAGE_CSP).toContain("object-src 'none'");
    expect(PAGE_CSP).toContain("script-src 'self' 'unsafe-inline'");
  });
});
