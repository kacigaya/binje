/**
 * Client for the local cast companion (`companion/`).
 *
 * The companion talks Chrome DevTools Protocol so the page does not have to:
 * it enables Cast discovery, reports sinks, and drives `Cast.startTabMirroring`
 * on the tab this app is running in. Everything here is a fixed request against
 * a loopback origin — no CDP method ever crosses this boundary.
 */

const DEFAULT_COMPANION_ORIGIN = "http://127.0.0.1:8747";

/** A trailing slash or a path would turn every request into a 404. */
function companionOrigin(configured: string | undefined) {
  if (!configured) return DEFAULT_COMPANION_ORIGIN;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_COMPANION_ORIGIN;
  }
}

export const CAST_COMPANION_ORIGIN = companionOrigin(
  process.env.NEXT_PUBLIC_CAST_COMPANION_ORIGIN,
);

/** Keep in sync with `CAST_REQUEST_HEADER` in `companion/server.ts`. */
const CAST_REQUEST_HEADER = "X-Binje-Cast";
const CAST_REQUEST_HEADER_VALUE = "1";

const PROBE_TIMEOUT_MS = 1200;
const DISCOVERY_TIMEOUT_MS = 6000;
const COMMAND_TIMEOUT_MS = 10000;

export type CastDevice = { name: string; active: boolean };
export type TabCastStatus = { casting: boolean; sinkName: string | null };

export type TabCastErrorCode =
  | "unreachable"
  | "chrome-unavailable"
  | "tab-not-found"
  | "sink-unavailable"
  | "already-casting"
  | "cast-failed";

const ERROR_CODES: readonly TabCastErrorCode[] = [
  "unreachable",
  "chrome-unavailable",
  "tab-not-found",
  "sink-unavailable",
  "already-casting",
  "cast-failed",
];

export class TabCastError extends Error {
  readonly code: TabCastErrorCode;
  constructor(code: TabCastErrorCode, message: string) {
    super(message);
    this.name = "TabCastError";
    this.code = code;
  }
}

export function parseCompanionError(status: number, payload: unknown): TabCastError {
  const body = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const code = ERROR_CODES.find((candidate) => candidate === body.error);
  const message = typeof body.message === "string" && body.message !== "" ? body.message : `Cast companion returned ${status}.`;
  return new TabCastError(code ?? "cast-failed", message);
}

export function parseStatus(payload: unknown): TabCastStatus {
  const body = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const sinkName = typeof body.sinkName === "string" && body.sinkName !== "" ? body.sinkName : null;
  return { casting: body.casting === true && sinkName !== null, sinkName: body.casting === true ? sinkName : null };
}

export function parseDevices(payload: unknown): CastDevice[] {
  const body = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  if (!Array.isArray(body.sinks)) return [];
  const devices: CastDevice[] = [];
  for (const entry of body.sinks) {
    if (typeof entry !== "object" || entry === null) continue;
    const sink = entry as { name?: unknown; active?: unknown };
    if (typeof sink.name !== "string" || sink.name === "") continue;
    if (devices.some((device) => device.name === sink.name)) continue;
    devices.push({ name: sink.name, active: sink.active === true });
  }
  return devices;
}

function timeoutSignal(timeoutMs: number, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function request(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number; signal?: AbortSignal },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${CAST_COMPANION_ORIGIN}${path}`, {
      method: init.method,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: timeoutSignal(init.timeoutMs, init.signal),
      headers: {
        [CAST_REQUEST_HEADER]: CAST_REQUEST_HEADER_VALUE,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new TabCastError("unreachable", error instanceof Error ? error.message : "Cast companion unreachable.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw parseCompanionError(response.status, payload);
  return payload;
}

export type CastProvider = {
  /** Returns null when the companion is not running, so one call answers both
   *  "is this transport available" and "is it already casting". */
  status(signal?: AbortSignal): Promise<TabCastStatus | null>;
  getDevices(signal?: AbortSignal): Promise<CastDevice[]>;
  start(deviceName: string, signal?: AbortSignal): Promise<TabCastStatus>;
  stop(deviceName: string | null, signal?: AbortSignal): Promise<TabCastStatus>;
};

function currentTabUrl() {
  return typeof window === "undefined" ? null : window.location.href;
}

export const tabCastProvider: CastProvider = {
  async status(signal) {
    try {
      return parseStatus(await request("/health", { method: "GET", timeoutMs: PROBE_TIMEOUT_MS, signal }));
    } catch (error) {
      if (error instanceof TabCastError && error.code === "unreachable") return null;
      throw error;
    }
  },

  async getDevices(signal) {
    const tabUrl = currentTabUrl();
    const query = tabUrl ? `?tabUrl=${encodeURIComponent(tabUrl)}` : "";
    return parseDevices(
      await request(`/cast/sinks${query}`, { method: "GET", timeoutMs: DISCOVERY_TIMEOUT_MS, signal }),
    );
  },

  async start(deviceName, signal) {
    return parseStatus(
      await request("/cast/start", {
        method: "POST",
        body: { sinkName: deviceName, tabUrl: currentTabUrl() },
        timeoutMs: COMMAND_TIMEOUT_MS,
        signal,
      }),
    );
  },

  async stop(deviceName, signal) {
    return parseStatus(
      await request("/cast/stop", {
        method: "POST",
        body: deviceName === null ? {} : { sinkName: deviceName },
        timeoutMs: COMMAND_TIMEOUT_MS,
        signal,
      }),
    );
  },
};
