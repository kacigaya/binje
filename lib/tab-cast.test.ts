import { afterEach, describe, expect, test } from "bun:test";
import {
  CAST_COMPANION_ORIGIN,
  parseCompanionError,
  parseDevices,
  parseStatus,
  TabCastError,
  tabCastProvider,
} from "./tab-cast";

const realFetch = globalThis.fetch;

type StubbedCall = { url: string; init: RequestInit };

function stubFetch(reply: (call: StubbedCall) => Response | Promise<Response>) {
  const calls: StubbedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  return calls;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("parseDevices", () => {
  test("keeps named sinks and drops duplicates and junk", () => {
    expect(
      parseDevices({
        sinks: [
          { name: "Living Room TV", active: true },
          { name: "Living Room TV" },
          { name: "" },
          { active: true },
          null,
        ],
      }),
    ).toEqual([{ name: "Living Room TV", active: true }]);
  });

  test("returns nothing for a malformed payload", () => {
    expect(parseDevices(null)).toEqual([]);
    expect(parseDevices({ sinks: "Living Room TV" })).toEqual([]);
  });
});

describe("parseStatus", () => {
  test("only reports casting when a sink is named", () => {
    expect(parseStatus({ casting: true, sinkName: "Living Room TV" })).toEqual({
      casting: true,
      sinkName: "Living Room TV",
    });
    expect(parseStatus({ casting: true })).toEqual({ casting: false, sinkName: null });
    expect(parseStatus({ casting: false, sinkName: "Living Room TV" })).toEqual({
      casting: false,
      sinkName: null,
    });
  });
});

describe("parseCompanionError", () => {
  test("keeps a known code and its message", () => {
    const error = parseCompanionError(409, { error: "sink-unavailable", message: "gone" });
    expect(error.code).toBe("sink-unavailable");
    expect(error.message).toBe("gone");
  });

  test("falls back to a generic failure for anything unrecognized", () => {
    const error = parseCompanionError(500, { error: "kaboom" });
    expect(error.code).toBe("cast-failed");
    expect(error.message).toBe("Cast companion returned 500.");
  });
});

describe("tabCastProvider", () => {
  test("reports the companion as absent instead of throwing", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(await tabCastProvider.status()).toBeNull();
  });

  test("reads an active session from the companion", async () => {
    stubFetch(() => json({ ok: true, casting: true, sinkName: "Living Room TV" }));
    expect(await tabCastProvider.status()).toEqual({
      casting: true,
      sinkName: "Living Room TV",
    });
  });

  test("sends the header that forces a preflight on every request", async () => {
    const calls = stubFetch(() => json({ sinks: [] }));
    await tabCastProvider.getDevices();
    const headers = new Headers(calls[0].init.headers);
    expect(calls[0].url.startsWith(`${CAST_COMPANION_ORIGIN}/cast/sinks`)).toBe(true);
    expect(headers.get("x-binje-cast")).toBe("1");
    expect(calls[0].init.credentials).toBe("omit");
    expect(calls[0].init.mode).toBe("cors");
  });

  test("posts the chosen device to the start endpoint", async () => {
    const calls = stubFetch(() => json({ casting: true, sinkName: "Living Room TV" }));
    expect(await tabCastProvider.start("Living Room TV")).toEqual({
      casting: true,
      sinkName: "Living Room TV",
    });
    expect(calls[0].url).toBe(`${CAST_COMPANION_ORIGIN}/cast/start`);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ sinkName: "Living Room TV" });
  });

  test("turns a companion failure into a typed error", async () => {
    stubFetch(() => json({ error: "chrome-unavailable", message: "no debug port" }, 502));
    const failure = tabCastProvider.start("Living Room TV");
    expect(failure).rejects.toBeInstanceOf(TabCastError);
    await failure.catch((error: TabCastError) => {
      expect(error.code).toBe("chrome-unavailable");
      expect(error.message).toBe("no debug port");
    });
  });

  test("reports a companion that vanished mid-session as unreachable", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    await tabCastProvider.stop("Living Room TV").catch((error: TabCastError) => {
      expect(error.code).toBe("unreachable");
    });
  });
});
