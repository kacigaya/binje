import { apiRequest, normalizeBaseUrl } from "../client";

describe("API client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test("normalizes the configured origin", () => {
    expect(normalizeBaseUrl("https://example.com///")).toBe("https://example.com");
    expect(() => normalizeBaseUrl("not-a-url")).toThrow("valid HTTP URL");
  });

  test("requests JSON and preserves encoded query values", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as jest.Mock;

    await expect(
      apiRequest<{ ok: boolean }>("/api/search", {
        baseUrl: "https://example.com/",
        query: { q: "Dune Part Two", lang: "fr", empty: undefined },
      }),
    ).resolves.toEqual({ ok: true });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/api/search?q=Dune+Part+Two&lang=fr",
      expect.objectContaining({ headers: { Accept: "application/json" }, method: "GET" }),
    );
  });

  test("supports POST requests without changing the JSON contract", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "token" }),
    }) as jest.Mock;

    await apiRequest("/api/cast", {
      baseUrl: "https://example.com",
      method: "POST",
      body: { url: "https://cdn.test/master.m3u8", subtitles: [] },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/api/cast",
      expect.objectContaining({
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.test/master.m3u8", subtitles: [] }),
      }),
    );
  });

  test("throws a structured error response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: "RATE_LIMITED", message: "Slow down." } }),
    }) as jest.Mock;

    await expect(apiRequest("/api/search", { baseUrl: "https://example.com" })).rejects.toEqual(
      expect.objectContaining({ status: 429, code: "RATE_LIMITED", message: "Slow down." }),
    );
  });

  test("aborts a stalled Cast authorization at the configured five-second deadline", async () => {
    jest.useFakeTimers();
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init.signal!;
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new Error("request deadline")), { once: true });
    })) as jest.Mock;
    const pending = apiRequest("/api/cast", { baseUrl: "https://example.com", method: "POST", timeoutMs: 5000 });
    const rejected = expect(pending).rejects.toThrow("request deadline");
    await jest.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(signals[0].aborted).toBe(true);
  });

  test("falls back when an error body is malformed", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("bad json");
      },
    }) as jest.Mock;

    await expect(apiRequest("/api/mobile/home", { baseUrl: "https://example.com" })).rejects.toEqual(
      expect.objectContaining({ status: 502, message: "Request failed with status 502." }),
    );
  });
});
