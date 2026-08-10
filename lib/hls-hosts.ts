// /api/hls used to proxy any public URL, which made it an open relay. Stream
// hosts are dynamic CDN names, so instead of a static allowlist the resolvers
// register every host they hand out and the proxy serves only those.
// ponytail: in-memory, per-instance, lost on restart (playback then needs a
// re-resolve). Move to a shared store only when running more than one instance.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HOSTS = 1000;

const hosts = new Map<string, number>();

export function allowStreamHost(url: string | URL): void {
  let host: string;
  try {
    host = new URL(String(url)).host;
  } catch {
    return;
  }
  if (hosts.size >= MAX_HOSTS) {
    const now = Date.now();
    for (const [key, expiresAt] of hosts) if (now > expiresAt) hosts.delete(key);
  }
  hosts.set(host, Date.now() + TTL_MS);
}

export function allowStreamHosts(urls: (string | undefined)[]): void {
  for (const url of urls) if (url) allowStreamHost(url);
}

export function isAllowedStreamHost(url: URL): boolean {
  const expiresAt = hosts.get(url.host);
  if (expiresAt === undefined) return false;
  if (Date.now() > expiresAt) {
    hosts.delete(url.host);
    return false;
  }
  return true;
}
