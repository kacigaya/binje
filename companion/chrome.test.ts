import { describe, expect, test } from "bun:test";
import {
  fetchBrowserSocketUrl,
  isAllowedOrigin,
  parseTargets,
  selectCastTarget,
  type ChromeTarget,
} from "./chrome";

const ORIGINS = ["http://localhost:3000", "https://binje.duckdns.org"] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function page(targetId: string, url: string): ChromeTarget {
  return { targetId, type: "page", url, title: "b!nje" };
}

describe("fetchBrowserSocketUrl", () => {
  test("returns the loopback endpoint Chrome advertises", async () => {
    const url = await fetchBrowserSocketUrl(9222, async () =>
      jsonResponse({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc" }),
    );
    expect(url).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
  });

  test("reports Chrome as unavailable when nothing is listening", () => {
    expect(
      fetchBrowserSocketUrl(9222, async () => {
        throw new TypeError("connection refused");
      }),
    ).rejects.toThrow("Chrome is not listening for DevTools connections on port 9222.");
  });

  test("reports Chrome as unavailable on a non-OK response", () => {
    expect(fetchBrowserSocketUrl(9222, async () => jsonResponse({}, 500))).rejects.toThrow(
      "Chrome DevTools endpoint returned 500.",
    );
  });

  test("refuses an endpoint that points off the loopback debug port", async () => {
    for (const webSocketDebuggerUrl of [
      "ws://evil.example/devtools/browser/abc",
      "ws://127.0.0.1:9333/devtools/browser/abc",
      "wss://127.0.0.1:9222/devtools/browser/abc",
      42,
    ]) {
      expect(
        fetchBrowserSocketUrl(9222, async () => jsonResponse({ webSocketDebuggerUrl })),
      ).rejects.toThrow("Chrome returned an unexpected DevTools endpoint.");
    }
  });
});

describe("parseTargets", () => {
  test("keeps well-formed targets and drops the rest", () => {
    expect(
      parseTargets({
        targetInfos: [
          { targetId: "a", type: "page", url: "http://localhost:3000/en", title: "b!nje" },
          { targetId: "b", type: "page" },
          { type: "page", url: "http://localhost:3000/fr" },
          null,
        ],
      }),
    ).toEqual([
      { targetId: "a", type: "page", url: "http://localhost:3000/en", title: "b!nje" },
      { targetId: "b", type: "page", url: "", title: "" },
    ]);
  });

  test("returns nothing when Chrome sends no target list", () => {
    expect(parseTargets({})).toEqual([]);
  });
});

describe("isAllowedOrigin", () => {
  test("matches on origin only", () => {
    expect(isAllowedOrigin("http://localhost:3000/en/watch/1", ORIGINS)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3001/en", ORIGINS)).toBe(false);
    expect(isAllowedOrigin("not a url", ORIGINS)).toBe(false);
    expect(isAllowedOrigin(null, ORIGINS)).toBe(false);
  });
});

describe("selectCastTarget", () => {
  test("ignores tabs that are not pages on an allowed origin", () => {
    const targets = [
      { targetId: "sw", type: "service_worker", url: "http://localhost:3000/sw.js", title: "" },
      page("bank", "https://bank.example/transfer"),
      page("app", "http://localhost:3000/en/watch/1"),
    ];
    expect(selectCastTarget(targets, ORIGINS, null)?.targetId).toBe("app");
  });

  test("returns null when no app tab is open", () => {
    expect(selectCastTarget([page("bank", "https://bank.example/")], ORIGINS, null)).toBeNull();
  });

  test("prefers the exact tab the caller named", () => {
    const targets = [
      page("other", "http://localhost:3000/en"),
      page("watch", "http://localhost:3000/en/watch/tv/1?s=1"),
    ];
    expect(
      selectCastTarget(targets, ORIGINS, "http://localhost:3000/en/watch/tv/1?s=1")?.targetId,
    ).toBe("watch");
  });

  test("falls back to the same path, then the same origin", () => {
    const targets = [
      page("other", "https://binje.duckdns.org/en"),
      page("watch", "http://localhost:3000/en/watch/1?q=2"),
    ];
    expect(selectCastTarget(targets, ORIGINS, "http://localhost:3000/en/watch/1")?.targetId).toBe(
      "watch",
    );
    expect(selectCastTarget(targets, ORIGINS, "https://binje.duckdns.org/fr")?.targetId).toBe(
      "other",
    );
  });

  test("never lets a hint widen the selection past the allowlist", () => {
    const targets = [page("app", "http://localhost:3000/en")];
    expect(selectCastTarget(targets, ORIGINS, "https://bank.example/transfer")?.targetId).toBe(
      "app",
    );
    expect(selectCastTarget([page("bank", "https://bank.example/")], ORIGINS, "https://bank.example/")).toBeNull();
  });
});
