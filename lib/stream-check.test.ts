import { afterEach, expect, mock, test } from "bun:test";
import { isAllowedStreamHost } from "./hls-hosts";
import { fetchText, firstInOrder, httpUrl, isPlayableManifest } from "./stream-check";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("waits for an earlier task before accepting a later success", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const winner = firstInOrder([first.promise, second.promise]);
  second.resolve("second");
  await Promise.resolve();
  first.resolve("first");
  expect(await winner).toBe("first");
});

test("falls through failures in order and rejects when none succeed", async () => {
  expect(await firstInOrder([Promise.reject(new Error("a")), Promise.resolve("b"), Promise.resolve("c")])).toBe("b");
  await expect(firstInOrder([Promise.reject(new Error("a"))])).rejects.toThrow("No playable stream.");
  await expect(firstInOrder([])).rejects.toThrow("No playable stream.");
});

test("keeps only credential-free http URLs, resolved against a base", () => {
  expect(httpUrl("/_stream?id=1", "https://player.test/pl/")).toBe("https://player.test/_stream?id=1");
  expect(httpUrl("javascript:alert(1)")).toBeUndefined();
  expect(httpUrl("https://user:pass@cdn.test/x")).toBeUndefined();
  expect(httpUrl(42)).toBeUndefined();
});

test("counts only manifests that load, with the provider's headers", async () => {
  const seen: Headers[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return seen.length === 1
      ? new Response("\uFEFF#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n")
      : new Response("<html>blocked</html>", { headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  expect(await isPlayableManifest("https://203.0.113.40/master.m3u8", { referer: "https://player.test/e/1", userAgent: "Pinned" })).toBe(true);
  expect(seen[0].get("referer")).toBe("https://player.test/e/1");
  expect(seen[0].get("origin")).toBe("https://player.test");
  expect(seen[0].get("user-agent")).toBe("Pinned");
  expect(await isPlayableManifest("https://203.0.113.40/master.m3u8")).toBe(false);
  expect(await isPlayableManifest("http://127.0.0.1/master.m3u8")).toBe(false);
  expect(seen).toHaveLength(2);
});

test("provider requests refuse private targets and leave the proxy allowlist alone", async () => {
  const calls: string[] = [];
  globalThis.fetch = mock(async (input: unknown) => {
    calls.push(String(input));
    return String(input).includes("203.0.113.41")
      ? new Response(null, { status: 302, headers: { location: "https://203.0.113.42/page" } })
      : String(input).includes("203.0.113.42")
        ? new Response("<html>ok</html>")
        : new Response(null, { status: 302, headers: { location: "http://10.0.0.1/admin" } });
  }) as unknown as typeof fetch;
  await expect(fetchText("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
  expect(await fetchText("https://203.0.113.41/start")).toBe("<html>ok</html>");
  expect(isAllowedStreamHost(new URL("https://203.0.113.42/x"))).toBe(false);
  await expect(fetchText("https://203.0.113.43/start")).rejects.toThrow("Blocked redirect target.");
  expect(calls.some((url) => url.includes("169.254") || url.includes("10.0.0.1"))).toBe(false);
});
