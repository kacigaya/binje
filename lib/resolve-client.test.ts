import { afterEach, expect, mock, test } from "bun:test";
import { fetchResolve } from "./resolve-client";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("shares pending resolves but refreshes signed URLs on retry", async () => {
  let calls = 0;
  globalThis.fetch = mock(async () => Response.json({ url: `https://cdn.test/${++calls}` })) as unknown as typeof fetch;
  const first = fetchResolve("/api/resolve?test=retry");
  expect(fetchResolve("/api/resolve?test=retry")).toBe(first);
  expect((await first).url).toBe("https://cdn.test/1");
  expect((await fetchResolve("/api/resolve?test=retry", true)).url).toBe("https://cdn.test/2");
});
