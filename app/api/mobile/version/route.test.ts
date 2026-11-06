import { afterEach, expect, test } from "bun:test";
import { GET, versionDependencies } from "./route";

const original = { ...versionDependencies };
afterEach(() => Object.assign(versionDependencies, original));
const release = { tag_name: "v1.5.0", html_url: "https://github.com/kacigaya/binje/releases/tag/v1.5.0", assets: [] };

// A failed lookup is not cached, so it runs before the success that fills the cache.
test("answers 502 without caching when GitHub fails", async () => {
  versionDependencies.fetchJson = async () => { throw new Error("down"); };
  const response = await GET();
  expect(response.status).toBe(502);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

test("returns the latest release and reuses it", async () => {
  let calls = 0;
  versionDependencies.fetchJson = async () => { calls++; return release; };
  const first = await GET();
  expect(first.status).toBe(200);
  expect((await first.json()).version).toBe("1.5.0");
  expect(first.headers.get("cache-control")).toContain("max-age=900");
  await GET();
  expect(calls).toBe(1);
});
