// The proxy serves only resolver-registered hosts.
// This allowlist is per instance; multiple instances need a shared store.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HOSTS = 1000;

const hosts = new Map<string, { expiresAt: number; referer?: string }>();

// Hosts without a Referer get neither Referer nor Origin.
export function allowStreamHost(url: string | URL, referer?: string): void {
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
  hosts.set(host, { expiresAt: Date.now() + TTL_MS, referer: referer ?? previous?.referer });
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
