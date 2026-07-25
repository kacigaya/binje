import { afterEach, describe, expect, test } from "bun:test";
import {
  clearResolveCache,
  fetchResolve,
  ResolveError,
} from "@/lib/resolve-client";

const REAL_FETCH = globalThis.fetch;

function stubFetch(handler: () => Response | Promise<Response>) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return handler();
  }) as typeof fetch;
  return () => calls;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  clearResolveCache();
});

describe("fetchResolve", () => {
  test("caches a successful resolve per url", async () => {
    const calls = stubFetch(() => jsonResponse({ url: "https://cdn/a.m3u8" }));

    const first = await fetchResolve("/api/resolve?id=1");
    const second = await fetchResolve("/api/resolve?id=1");
    await fetchResolve("/api/resolve?id=2");

    expect(first.url).toBe("https://cdn/a.m3u8");
    expect(second).toBe(first);
    expect(calls()).toBe(2);
  });

  test("maps rejected params to an invalid failure", async () => {
    stubFetch(() => jsonResponse({ error: "Invalid params." }, 400));

    const failure = await fetchResolve("/api/resolve?id=bad").catch((e) => e);

    expect(failure).toBeInstanceOf(ResolveError);
    expect(failure.reason).toBe("invalid");
    expect(failure.status).toBe(400);
  });

  test("maps a failed upstream resolve to an unavailable failure", async () => {
    stubFetch(() => jsonResponse({ error: "Failed to resolve stream." }, 502));

    const failure = await fetchResolve("/api/resolve?id=3").catch((e) => e);

    expect(failure).toBeInstanceOf(ResolveError);
    expect(failure.reason).toBe("unavailable");
    expect(failure.status).toBe(502);
  });

  test("maps a transport error to a network failure", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    const failure = await fetchResolve("/api/resolve?id=4").catch((e) => e);

    expect(failure).toBeInstanceOf(ResolveError);
    expect(failure.reason).toBe("network");
    expect(failure.status).toBe(0);
  });

  test("does not cache failures, so a retry refetches", async () => {
    let ok = false;
    const calls = stubFetch(() =>
      ok ? jsonResponse({ url: "https://cdn/b.m3u8" }) : jsonResponse({}, 502),
    );

    await expect(fetchResolve("/api/resolve?id=5")).rejects.toBeInstanceOf(
      ResolveError,
    );
    ok = true;
    const result = await fetchResolve("/api/resolve?id=5");

    expect(result.url).toBe("https://cdn/b.m3u8");
    expect(calls()).toBe(2);
  });

  test("a pending rejection never evicts a newer entry", async () => {
    let ok = false;
    stubFetch(() =>
      ok ? jsonResponse({ url: "https://cdn/c.m3u8" }) : jsonResponse({}, 502),
    );

    const failing = fetchResolve("/api/resolve?id=6").catch(() => null);
    ok = true;
    clearResolveCache("/api/resolve?id=6");
    const retried = fetchResolve("/api/resolve?id=6");
    await failing;

    expect(fetchResolve("/api/resolve?id=6")).toBe(retried);
    expect((await retried).url).toBe("https://cdn/c.m3u8");
  });

  test("treats an unparsable body as unavailable", async () => {
    stubFetch(() => new Response("<!DOCTYPE html>", { status: 200 }));

    const failure = await fetchResolve("/api/resolve?id=7").catch((e) => e);

    expect(failure).toBeInstanceOf(ResolveError);
    expect(failure.reason).toBe("unavailable");
  });
});
