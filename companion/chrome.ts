/**
 * Chrome discovery helpers: locating the browser's DevTools endpoint and
 * picking the tab that belongs to the web app.
 */

import { SERVER_HOSTNAME } from "./config";

export type ChromeTarget = {
  targetId: string;
  type: string;
  url: string;
  title: string;
};

/** Narrow seam for the one request the companion makes over plain HTTP. */
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export class ChromeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChromeUnavailableError";
  }
}

function safeUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isAllowedOrigin(value: string | null | undefined, allowed: readonly string[]) {
  const url = safeUrl(value);
  return url !== null && allowed.includes(url.origin);
}

/**
 * Reads Chrome's browser-level WebSocket endpoint. The returned URL is checked
 * against the loopback debug port we asked for, so a hijacked `/json/version`
 * response cannot redirect the connection somewhere else.
 */
export async function fetchBrowserSocketUrl(
  chromeDebugPort: number,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`http://${SERVER_HOSTNAME}:${chromeDebugPort}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    throw new ChromeUnavailableError(
      `Chrome is not listening for DevTools connections on port ${chromeDebugPort}.`,
    );
  }
  if (!response.ok) {
    throw new ChromeUnavailableError(`Chrome DevTools endpoint returned ${response.status}.`);
  }

  const payload = (await response.json()) as { webSocketDebuggerUrl?: unknown };
  const socketUrl = safeUrl(
    typeof payload.webSocketDebuggerUrl === "string" ? payload.webSocketDebuggerUrl : null,
  );
  if (
    !socketUrl ||
    socketUrl.protocol !== "ws:" ||
    (socketUrl.hostname !== SERVER_HOSTNAME && socketUrl.hostname !== "localhost") ||
    socketUrl.port !== String(chromeDebugPort)
  ) {
    throw new ChromeUnavailableError("Chrome returned an unexpected DevTools endpoint.");
  }
  return socketUrl.href;
}

export function parseTargets(result: Record<string, unknown>): ChromeTarget[] {
  const infos = Array.isArray(result.targetInfos) ? result.targetInfos : [];
  const targets: ChromeTarget[] = [];
  for (const info of infos) {
    if (typeof info !== "object" || info === null) continue;
    const entry = info as { targetId?: unknown; type?: unknown; url?: unknown; title?: unknown };
    if (typeof entry.targetId !== "string" || typeof entry.type !== "string") continue;
    targets.push({
      targetId: entry.targetId,
      type: entry.type,
      url: typeof entry.url === "string" ? entry.url : "",
      title: typeof entry.title === "string" ? entry.title : "",
    });
  }
  return targets;
}

/**
 * Resolves the tab to mirror. The allowlist decides which tabs are eligible;
 * the caller-supplied URL only orders the eligible ones, so a hostile page
 * cannot point the companion at an unrelated tab.
 */
export function selectCastTarget(
  targets: readonly ChromeTarget[],
  allowedOrigins: readonly string[],
  tabUrlHint: string | null,
): ChromeTarget | null {
  const candidates = targets.filter(
    (target) => target.type === "page" && isAllowedOrigin(target.url, allowedOrigins),
  );
  if (candidates.length === 0) return null;

  const hint = safeUrl(tabUrlHint);
  if (!hint || !allowedOrigins.includes(hint.origin)) return candidates[0];

  return (
    candidates.find((target) => target.url === hint.href) ??
    candidates.find((target) => {
      const url = safeUrl(target.url);
      return url?.origin === hint.origin && url.pathname === hint.pathname;
    }) ??
    candidates.find((target) => safeUrl(target.url)?.origin === hint.origin) ??
    candidates[0]
  );
}
