import { ApiError, apiRequest, normalizeBaseUrl } from "../client";

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
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  test("throws a structured error response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: "RATE_LIMITED", message: "Slow down." } }),
    }) as jest.Mock;

    await expect(apiRequest("/api/search", { baseUrl: "https://example.com" })).rejects.toEqual(
      expect.objectContaining<ApiError>({ status: 429, code: "RATE_LIMITED", message: "Slow down." }),
    );
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
      expect.objectContaining<ApiError>({ status: 502, message: "Request failed with status 502." }),
    );
  });
});
