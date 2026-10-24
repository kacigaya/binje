import { afterEach, expect, mock, test } from "bun:test";
import { CAST_RENEWAL_MS, requestCastToken } from "./cast-client";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("requests a Cast token with media and subtitle target hosts", async () => {
  const requests: RequestInit[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    requests.push(init ?? {});
    return Response.json({ token: "a".repeat(32) });
  }) as unknown as typeof fetch;
  expect(await requestCastToken("https://cdn.test/master.m3u8", ["https://subs.test/en.vtt"])).toBe("a".repeat(32));
  expect(requests[0].headers).toEqual({ "Content-Type": "application/json" });
  expect(JSON.parse(String(requests[0].body))).toEqual({ url: "https://cdn.test/master.m3u8", subtitles: ["https://subs.test/en.vtt"] });
  expect(CAST_RENEWAL_MS).toBe(240_000);
});

test("rejects failed or malformed Cast authorization", async () => {
  for (const data of [null, {}, { token: "short" }]) {
    globalThis.fetch = mock(async () => Response.json(data)) as unknown as typeof fetch;
    await expect(requestCastToken("https://cdn.test/master.m3u8", [])).rejects.toThrow("Invalid Cast authorization response.");
  }
  globalThis.fetch = mock(async () => new Response(null, { status: 403 })) as unknown as typeof fetch;
  await expect(requestCastToken("https://cdn.test/master.m3u8", [])).rejects.toThrow("Cast authorization failed.");
});

test("aborts stalled Cast authorization at five seconds and propagates cancellation", async () => {
  const realSetTimeout = globalThis.setTimeout;
  const deadlines: number[] = [];
  globalThis.setTimeout = ((handler: () => void, delay: number) => {
    deadlines.push(delay);
    return realSetTimeout(handler, 0);
  }) as typeof setTimeout;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  })) as unknown as typeof fetch;
  try {
    await expect(requestCastToken("https://cdn.test/master.m3u8", [])).rejects.toThrow();
    expect(deadlines).toEqual([5000]);
    const controller = new AbortController();
    controller.abort(new Error("sender disconnected"));
    await expect(requestCastToken("https://cdn.test/master.m3u8", [], controller.signal)).rejects.toThrow("sender disconnected");
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});
