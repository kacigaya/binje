// The proxy serves only resolver-registered hosts.
// This allowlist is per instance; multiple instances need a shared store.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HOSTS = 1000;

const hosts = new Map<string, { expiresAt: number; referer?: string; userAgent?: string }>();

// Pin User-Agent for providers that sign it; otherwise forward the viewer's.
// An empty referer means send neither Referer nor Origin.
export function allowStreamHost(url: string | URL, referer?: string, userAgent?: string): void {
  let host: string;
  try {
    host = new URL(String(url)).host;
  } catch {
    return;
  }
  if (hosts.size >= MAX_HOSTS) {
    const now = Date.now();
    for (const [key, entry] of hosts) if (now > entry.expiresAt) hosts.delete(key);
  }
  const previous = hosts.get(host);
  hosts.set(host, {
    expiresAt: Date.now() + TTL_MS,
    referer: referer ?? previous?.referer,
    userAgent: userAgent ?? previous?.userAgent,
  });
}

export function allowStreamHosts(urls: (string | undefined)[]): void {
  for (const url of urls) if (url) allowStreamHost(url);
}

export function isAllowedStreamHost(url: URL): boolean {
  const entry = hosts.get(url.host);
  if (entry === undefined) return false;
  if (Date.now() > entry.expiresAt) {
    hosts.delete(url.host);
    return false;
  }
  return true;
}

export function streamReferer(url: URL): string | undefined {
  return isAllowedStreamHost(url) ? hosts.get(url.host)?.referer : undefined;
}

export function streamUserAgent(url: URL): string | undefined {
  return isAllowedStreamHost(url) ? hosts.get(url.host)?.userAgent : undefined;
}

// Scope signed cookies by URL prefix so they cannot escape their directory.
// Register the scope's host too, since no other resolver supplies these URLs.
const cookies = new Map<string, { expiresAt: number; cookie: string }>();

export function allowStreamCookie(scope: string, cookie: string): void {
  let prefix: string;
  try {
    prefix = new URL(scope).href;
  } catch {
    return;
  }
  if (cookies.size >= MAX_HOSTS) {
    const now = Date.now();
    for (const [key, entry] of cookies) if (now > entry.expiresAt) cookies.delete(key);
  }
  cookies.set(prefix, { expiresAt: Date.now() + TTL_MS, cookie });
  allowStreamHost(prefix);
}

export function streamCookie(url: URL): string | undefined {
  const now = Date.now();
  let match: { prefix: string; cookie: string } | undefined;
  for (const [prefix, entry] of cookies) {
    if (now > entry.expiresAt) {
      cookies.delete(prefix);
      continue;
    }
    if (url.href.startsWith(prefix) && (!match || prefix.length > match.prefix.length)) {
      match = { prefix, cookie: entry.cookie };
    }
  }
  return match?.cookie;
}
