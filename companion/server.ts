/**
 * The companion's HTTP surface.
 *
 * Deliberately tiny: four endpoints, no pass-through of CDP method names, and
 * no route that accepts anything other than a sink name and a tab URL hint.
 *
 * Access control, in order:
 *   1. `Origin` must be present and allowlisted — a page from anywhere else is
 *      rejected before any Chrome work happens.
 *   2. A custom request header must be present. Browsers cannot attach it to a
 *      cross-origin request without a preflight, which step 1 then fails, so
 *      this is the CSRF guard for the state-changing routes.
 *   3. `Sec-Fetch-Mode`, when the browser sends it, must be `cors`, which rules
 *      out navigations and `no-cors` form posts.
 */

import { CastError, type CastController } from "./cast-controller";
import { ChromeUnavailableError } from "./chrome";
import type { CompanionConfig } from "./config";

/** Keep in sync with `CAST_REQUEST_HEADER` in `lib/tab-cast.ts`. */
export const CAST_REQUEST_HEADER = "x-binje-cast";
/** Keep in sync with `CAST_REQUEST_HEADER_VALUE` in `lib/tab-cast.ts`. */
export const CAST_REQUEST_HEADER_VALUE = "1";

const MAX_BODY_BYTES = 4096;
const MAX_SINK_NAME_LENGTH = 128;
const MAX_TAB_URL_LENGTH = 2048;

const STATUS_BY_CODE: Record<string, number> = {
  "invalid-request": 400,
  forbidden: 403,
  "not-found": 404,
  "already-casting": 409,
  "tab-not-found": 409,
  "sink-unavailable": 409,
  "cast-failed": 502,
  "chrome-unavailable": 502,
};

class RequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RequestError";
    this.code = code;
  }
}

function corsHeaders(origin: string | null) {
  const headers = new Headers({ "cache-control": "no-store", vary: "Origin" });
  if (origin) headers.set("access-control-allow-origin", origin);
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  const headers = corsHeaders(origin);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function preflight(origin: string) {
  const headers = corsHeaders(origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", `content-type, ${CAST_REQUEST_HEADER}`);
  headers.set("access-control-max-age", "600");
  // Chrome gates public-page-to-loopback requests behind this opt-in.
  headers.set("access-control-allow-private-network", "true");
  return new Response(null, { status: 204, headers });
}

export function validateSinkName(value: unknown): string {
  if (typeof value !== "string") throw new RequestError("invalid-request", "Missing sink name.");
  const name = value.trim();
  if (name.length === 0 || name.length > MAX_SINK_NAME_LENGTH) {
    throw new RequestError("invalid-request", "Invalid sink name.");
  }
  // Control characters would only ever come from a forged request; Chrome's
  // sink names never contain them.
  if (/\p{C}/u.test(name)) throw new RequestError("invalid-request", "Invalid sink name.");
  return name;
}

export function validateTabUrl(value: unknown, allowedOrigins: readonly string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_TAB_URL_LENGTH) {
    throw new RequestError("invalid-request", "Invalid tab URL.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError("invalid-request", "Invalid tab URL.");
  }
  if (!allowedOrigins.includes(url.origin)) {
    throw new RequestError("forbidden", "That tab is not served by an allowed origin.");
  }
  return url.href;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestError("invalid-request", "Expected a JSON body.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new RequestError("invalid-request", "Request body too large.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new RequestError("invalid-request", "Request body too large.");
  }
  if (text.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestError("invalid-request", "Malformed JSON body.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RequestError("invalid-request", "Malformed JSON body.");
  }
  return parsed as Record<string, unknown>;
}

export type CastServer = {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
};

export function createCastServer(
  config: CompanionConfig,
  controller: CastController,
): CastServer {
  const { allowedOrigins } = config;

  async function route(request: Request, pathname: string, origin: string) {
    if (request.method === "GET" && pathname === "/health") {
      return json({ ok: true, ...controller.status() }, 200, origin);
    }

    if (request.method === "GET" && pathname === "/cast/sinks") {
      const tabUrl = validateTabUrl(
        new URL(request.url).searchParams.get("tabUrl"),
        allowedOrigins,
      );
      const sinks = await controller.listSinks(tabUrl);
      return json({ sinks, ...controller.status() }, 200, origin);
    }

    if (request.method === "POST" && pathname === "/cast/start") {
      const body = await readJsonBody(request);
      const sinkName = validateSinkName(body.sinkName);
      const tabUrl = validateTabUrl(body.tabUrl, allowedOrigins);
      return json(await controller.start(sinkName, tabUrl), 200, origin);
    }

    if (request.method === "POST" && pathname === "/cast/stop") {
      const body = await readJsonBody(request);
      const sinkName = body.sinkName === undefined ? null : validateSinkName(body.sinkName);
      return json(await controller.stop(sinkName), 200, origin);
    }

    throw new RequestError("not-found", "Unknown endpoint.");
  }

  return {
    async fetch(request) {
      const origin = request.headers.get("origin");
      const allowed = origin !== null && allowedOrigins.includes(origin);
      if (!allowed) {
        return json({ error: "forbidden", message: "Origin not allowed." }, 403, null);
      }

      if (request.method === "OPTIONS") return preflight(origin);

      if (request.headers.get(CAST_REQUEST_HEADER) !== CAST_REQUEST_HEADER_VALUE) {
        return json({ error: "forbidden", message: "Missing cast request header." }, 403, origin);
      }
      const fetchMode = request.headers.get("sec-fetch-mode");
      if (fetchMode !== null && fetchMode !== "cors") {
        return json({ error: "forbidden", message: "Unsupported request mode." }, 403, origin);
      }

      try {
        return await route(request, new URL(request.url).pathname, origin);
      } catch (error) {
        if (error instanceof RequestError) {
          return json(
            { error: error.code, message: error.message },
            STATUS_BY_CODE[error.code] ?? 400,
            origin,
          );
        }
        if (error instanceof CastError) {
          return json(
            { error: error.code, message: error.message },
            STATUS_BY_CODE[error.code] ?? 502,
            origin,
          );
        }
        if (error instanceof ChromeUnavailableError) {
          return json({ error: "chrome-unavailable", message: error.message }, 502, origin);
        }
        return json(
          { error: "cast-failed", message: "The cast companion hit an unexpected error." },
          500,
          origin,
        );
      }
    },

    close: () => controller.close(),
  };
}
