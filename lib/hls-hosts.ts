// /api/hls used to proxy any public URL, which made it an open relay. Stream
// hosts are dynamic CDN names, so instead of a static allowlist the resolvers
// register every host they hand out and the proxy serves only those.
// ponytail: in-memory, per-instance, lost on restart (playback then needs a
// re-resolve). Move to a shared store only when running more than one instance.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HOSTS = 1000;

const hosts = new Map<string, { expiresAt: number; referer?: string }>();

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
  hosts.set(host, { expiresAt: Date.now() + TTL_MS, referer: referer ?? hosts.get(host)?.referer });
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

// Some CDNs sign a directory rather than a host (CloudFront policy cookies),
// so the cookie is keyed by URL prefix and only sent to URLs beneath it. The
// scope also allows its host, since nothing else hands those URLs out.
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
