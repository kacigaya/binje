import { describe, expect, test } from "bun:test";
import { CastError, type CastController, type CastSink, type CastStatus } from "./cast-controller";
import { ChromeUnavailableError } from "./chrome";
import type { CompanionConfig } from "./config";
import { CAST_REQUEST_HEADER, CAST_REQUEST_HEADER_VALUE, createCastServer } from "./server";

const CONFIG: CompanionConfig = {
  port: 8747,
  chromeDebugPort: 9222,
  allowedOrigins: ["http://localhost:3000", "https://binje.duckdns.org"],
};
const ORIGIN = "http://localhost:3000";
const BASE = "http://127.0.0.1:8747";

type Calls = {
  listSinks: (string | null)[];
  start: [string, string | null][];
  stop: (string | null)[];
};

function stubController(overrides: Partial<CastController> = {}) {
  const calls: Calls = { listSinks: [], start: [], stop: [] };
  let status: CastStatus = { casting: false, sinkName: null };
  const sinks: CastSink[] = [{ name: "Living Room TV", active: false }];

  const controller: CastController = {
    status: () => status,
    listSinks: async (tabUrl) => {
      calls.listSinks.push(tabUrl);
      return sinks;
    },
    start: async (sinkName, tabUrl) => {
      calls.start.push([sinkName, tabUrl]);
      status = { casting: true, sinkName };
      return status;
    },
    stop: async (sinkName) => {
      calls.stop.push(sinkName);
      status = { casting: false, sinkName: null };
      return status;
    },
    close: async () => undefined,
    ...overrides,
  };

  return { server: createCastServer(CONFIG, controller), calls };
}

function call(
  path: string,
  init: {
    method?: string;
    origin?: string | null;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set("origin", init.origin ?? ORIGIN);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const CAST_HEADER = { [CAST_REQUEST_HEADER]: CAST_REQUEST_HEADER_VALUE };

describe("companion access control", () => {
  test("rejects a request with no Origin", async () => {
    const { server } = stubController();
    const response = await server.fetch(call("/health", { origin: null, headers: CAST_HEADER }));
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("rejects an origin that is not allowlisted", async () => {
    const { server } = stubController();
    const response = await server.fetch(
      call("/health", { origin: "https://evil.example", headers: CAST_HEADER }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "forbidden" });
  });

  test("rejects a request without the cast header, which is what forces a preflight", async () => {
    const { server } = stubController();
    const response = await server.fetch(call("/health"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: "Missing cast request header." });
  });

  test("rejects a non-CORS request mode", async () => {
    const { server } = stubController();
    const response = await server.fetch(
      call("/health", { headers: { ...CAST_HEADER, "sec-fetch-mode": "no-cors" } }),
    );
    expect(response.status).toBe(403);
  });

  test("answers the preflight with the loopback opt-in Chrome requires", async () => {
    const { server } = stubController();
    const response = await server.fetch(call("/cast/start", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-private-network")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain(CAST_REQUEST_HEADER);
    expect(response.headers.get("vary")).toBe("Origin");
  });

  test("returns 404 for anything outside the cast API", async () => {
    const { server } = stubController();
    const response = await server.fetch(call("/json/version", { headers: CAST_HEADER }));
    expect(response.status).toBe(404);
  });
});

describe("companion endpoints", () => {
  test("reports health and cast status", async () => {
    const { server } = stubController();
    const response = await server.fetch(call("/health", { headers: CAST_HEADER }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, casting: false, sinkName: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("lists sinks and forwards the tab hint", async () => {
    const { server, calls } = stubController();
    const response = await server.fetch(
      call(`/cast/sinks?tabUrl=${encodeURIComponent(`${ORIGIN}/en/watch/1`)}`, {
        headers: CAST_HEADER,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sinks: [{ name: "Living Room TV", active: false }],
    });
    expect(calls.listSinks).toEqual([`${ORIGIN}/en/watch/1`]);
  });

  test("refuses a tab hint pointing at another origin", async () => {
    const { server, calls } = stubController();
    const response = await server.fetch(
      call(`/cast/sinks?tabUrl=${encodeURIComponent("https://evil.example/")}`, {
        headers: CAST_HEADER,
      }),
    );
    expect(response.status).toBe(403);
    expect(calls.listSinks).toEqual([]);
  });

  test("starts mirroring on a named sink", async () => {
    const { server, calls } = stubController();
    const response = await server.fetch(
      call("/cast/start", {
        method: "POST",
        headers: CAST_HEADER,
        body: { sinkName: " Living Room TV ", tabUrl: `${ORIGIN}/en/watch/1` },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ casting: true, sinkName: "Living Room TV" });
    expect(calls.start).toEqual([["Living Room TV", `${ORIGIN}/en/watch/1`]]);
  });

  test("stops mirroring, with or without a named sink", async () => {
    const { server, calls } = stubController();
    await server.fetch(
      call("/cast/stop", {
        method: "POST",
        headers: CAST_HEADER,
        body: { sinkName: "Living Room TV" },
      }),
    );
    await server.fetch(call("/cast/stop", { method: "POST", headers: CAST_HEADER, body: {} }));
    expect(calls.stop).toEqual(["Living Room TV", null]);
  });
});

describe("companion request validation", () => {
  test("rejects a start without a usable sink name", async () => {
    const { server, calls } = stubController();
    // A control character can only reach a sink name through a forged request.
    const rejected: unknown[] = [undefined, "", "   ", 42, "Living\u0000Room", "x".repeat(129)];
    for (const sinkName of rejected) {
      const response = await server.fetch(
        call("/cast/start", { method: "POST", headers: CAST_HEADER, body: { sinkName } }),
      );
      expect(response.status).toBe(400);
    }
    expect(calls.start).toEqual([]);
  });

  test("rejects a body that is not a JSON object", async () => {
    const { server } = stubController();
    const request = new Request(`${BASE}/cast/stop`, {
      method: "POST",
      headers: new Headers({ origin: ORIGIN, ...CAST_HEADER, "content-type": "application/json" }),
      body: "[1,2,3]",
    });
    expect((await server.fetch(request)).status).toBe(400);
  });

  test("rejects a POST that is not declared as JSON", async () => {
    const { server } = stubController();
    const request = new Request(`${BASE}/cast/stop`, {
      method: "POST",
      headers: new Headers({ origin: ORIGIN, ...CAST_HEADER, "content-type": "text/plain" }),
      body: "{}",
    });
    expect((await server.fetch(request)).status).toBe(400);
  });

  test("rejects an oversized body", async () => {
    const { server } = stubController();
    const request = new Request(`${BASE}/cast/start`, {
      method: "POST",
      headers: new Headers({ origin: ORIGIN, ...CAST_HEADER, "content-type": "application/json" }),
      body: JSON.stringify({ sinkName: "x".repeat(8000) }),
    });
    expect((await server.fetch(request)).status).toBe(400);
  });
});

describe("companion error mapping", () => {
  test("maps controller failures onto meaningful statuses", async () => {
    const cases: [CastError["code"], number][] = [
      ["chrome-unavailable", 502],
      ["tab-not-found", 409],
      ["sink-unavailable", 409],
      ["already-casting", 409],
      ["cast-failed", 502],
    ];
    for (const [code, status] of cases) {
      const { server } = stubController({
        listSinks: async () => {
          throw new CastError(code, `failed: ${code}`);
        },
      });
      const response = await server.fetch(call("/cast/sinks", { headers: CAST_HEADER }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code, message: `failed: ${code}` });
    }
  });

  test("maps an unreachable Chrome onto a bad gateway", async () => {
    const { server } = stubController({
      listSinks: async () => {
        throw new ChromeUnavailableError("Chrome is not listening.");
      },
    });
    const response = await server.fetch(call("/cast/sinks", { headers: CAST_HEADER }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "chrome-unavailable" });
  });

  test("does not leak internal failures to the page", async () => {
    const { server } = stubController({
      listSinks: async () => {
        throw new Error("ENOENT /home/user/.config/chrome/Default/Cookies");
      },
    });
    const response = await server.fetch(call("/cast/sinks", { headers: CAST_HEADER }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("ENOENT");
  });
});
