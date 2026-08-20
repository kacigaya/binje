/**
 * Configuration for the local cast companion.
 *
 * Everything here is read once at startup. The hostname is deliberately not
 * configurable: binding anywhere but the loopback interface would turn this
 * into a remote control API for the user's browser.
 */

export const SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_SERVER_PORT = 8747;
export const DEFAULT_CHROME_DEBUG_PORT = 9222;

/** Origins that may drive the companion and whose tabs may be mirrored. */
const BUILT_IN_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://binje.duckdns.org",
];

export type CompanionConfig = {
  port: number;
  chromeDebugPort: number;
  allowedOrigins: readonly string[];
};

function parsePort(value: string | undefined, fallback: number, label: string) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d{1,5}$/.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error(`Invalid ${label}: ${value}`);
  return port;
}

/**
 * Normalizes a comma-separated origin list. Anything that is not an absolute
 * http(s) URL is dropped rather than silently widening the allowlist.
 */
export function parseOrigins(value: string | undefined): string[] {
  const origins: string[] = [];
  for (const entry of (value ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (!origins.includes(url.origin)) origins.push(url.origin);
  }
  return origins;
}

export function readCompanionConfig(env: Record<string, string | undefined>): CompanionConfig {
  const extra = parseOrigins(env.BINJE_CAST_ORIGINS);
  const allowedOrigins = [...BUILT_IN_ORIGINS, ...extra].filter(
    (origin, index, list) => list.indexOf(origin) === index,
  );

  return {
    port: parsePort(env.BINJE_CAST_PORT, DEFAULT_SERVER_PORT, "BINJE_CAST_PORT"),
    chromeDebugPort: parsePort(
      env.BINJE_CHROME_DEBUG_PORT,
      DEFAULT_CHROME_DEBUG_PORT,
      "BINJE_CHROME_DEBUG_PORT",
    ),
    allowedOrigins,
  };
}
