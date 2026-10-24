import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { verifyDeployment } from "../scripts/verify-deployment.mjs";
import { parseResolveParams } from "./sources";

function deploymentFetch(change?: (url: URL, response: Response) => Response): typeof fetch {
  return Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(String(input));
    expect(init?.redirect).toBe("manual");
    const response = new Response(null, {
      status: url.pathname === "/" ? 307 : 400,
      headers: {
        "cross-origin-opener-policy": "same-origin", "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
    return change ? change(url, response) : response;
  }, { preconnect: fetch.preconnect });
}

test("accepts a hardened deployment and checks an otherwise valid bogus-source request", async () => {
  const seen: URL[] = [];
  expect(await verifyDeployment("https://binje.test", deploymentFetch((url, response) => {
    seen.push(url);
    return response;
  }))).toHaveLength(4);
  const resolve = seen.find((url) => url.pathname === "/api/resolve")!;
  expect(resolve.searchParams.get("source")).toBe("bogus");
  expect(resolve.searchParams.get("type")).toBe("movie");
  expect(resolve.searchParams.get("id")).toBe("550");
  expect(parseResolveParams(resolve.searchParams)).not.toBeNull();
});

test.each(["cross-origin-opener-policy", "x-content-type-options"])("rejects missing %s", async (header) => {
  await expect(verifyDeployment("https://binje.test", deploymentFetch((_url, response) => {
    response.headers.delete(header);
    return response;
  }))).rejects.toThrow(header);
});

test.each([["/api/sources", 404], ["/api/resolve", 502]])("rejects stale %s status %s", async (path, status) => {
  await expect(verifyDeployment("https://binje.test", deploymentFetch((url, response) => url.pathname === path
    ? new Response(null, { status, headers: response.headers }) : response))).rejects.toThrow(`HTTP ${status}`);
});

test("accepts protected sources and rejects page CSP, wildcard CORS, and version headers", async () => {
  await expect(verifyDeployment("https://binje.test", deploymentFetch((url, response) => url.pathname === "/api/sources"
    ? new Response(null, { status: 401, headers: response.headers }) : response))).resolves.toHaveLength(4);
  for (const [header, value, expected] of [
    ["content-security-policy", "default-src 'self'; script-src 'unsafe-inline'", "isolated CSP"],
    ["access-control-allow-origin", "*", "wildcard CORS"],
    ["x-powered-by", "Next.js 16", "x-powered-by"],
  ]) {
    await expect(verifyDeployment("https://binje.test", deploymentFetch((_url, response) => {
      response.headers.set(header, value);
      return response;
    }))).rejects.toThrow(expected);
  }
});

test("reports network failures and exits nonzero for invalid CLI input", async () => {
  await expect(verifyDeployment("file:///tmp")).rejects.toThrow("Deployment target must be an HTTP(S) origin");
  await expect(verifyDeployment("https://binje.test", Object.assign(async () => {
    throw new Error("network unavailable");
  }, { preconnect: fetch.preconnect }))).rejects.toThrow("request failed");
  const result = spawnSync("node", ["scripts/verify-deployment.mjs", "file:///tmp"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8",
  });
  expect(result.status).toBe(1);
});
