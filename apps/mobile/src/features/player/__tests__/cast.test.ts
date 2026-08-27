import * as client from "../../../api/client";
import { castProxyUrl, createCastLoadRequest, requestCastToken } from "../cast";

jest.mock("../../../api/client", () => {
  const actual = jest.requireActual("../../../api/client");
  return { ...actual, apiRequest: jest.fn() };
});

const apiRequest = client.apiRequest as jest.Mock;

describe("native Google Cast media", () => {
  beforeEach(() => apiRequest.mockReset());

  test("builds an absolute token-bound proxy URL", () => {
    const url = new URL(
      castProxyUrl(
        "https://cdn.test/master.m3u8?quality=auto",
        "a".repeat(32),
        "https://binje.test/",
      ),
    );

    expect(url.origin).toBe("https://binje.test");
    expect(url.pathname).toBe("/api/hls");
    expect(url.searchParams.get("url")).toBe("https://cdn.test/master.m3u8?quality=auto");
    expect(url.searchParams.get("castToken")).toBe("a".repeat(32));
  });

  test("creates HLS media and subtitle tracks for the default receiver", () => {
    const request = createCastLoadRequest({
      source: "https://cdn.test/master.m3u8",
      token: "b".repeat(32),
      title: "Example",
      tracks: [{ file: "https://cdn.test/en.vtt", label: "English" }],
      startTime: 42,
      duration: 120,
      autoplay: true,
      baseUrl: "https://binje.test",
    });

    expect(request).toEqual(expect.objectContaining({ autoplay: true, startTime: 42 }));
    expect(request.mediaInfo).toEqual(expect.objectContaining({
      contentType: "application/vnd.apple.mpegurl",
      metadata: { type: "generic", title: "Example" },
      streamDuration: 120,
      mediaTracks: [expect.objectContaining({ id: 1, type: "text", name: "English" })],
    }));
  });

  test("requests and validates a cast token", async () => {
    apiRequest.mockResolvedValue({ token: "c".repeat(32) });

    await expect(requestCastToken()).resolves.toBe("c".repeat(32));
    expect(apiRequest).toHaveBeenCalledWith("/api/cast", {
      method: "POST",
      signal: undefined,
    });

    apiRequest.mockResolvedValueOnce({ token: "bad" });
    await expect(requestCastToken()).rejects.toThrow("Invalid Cast authorization response");
  });
});
