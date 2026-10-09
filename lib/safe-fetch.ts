import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import { allowStreamHost, streamCookie, streamUserAgent } from "@/lib/hls-hosts";

// Server-side fetches of provider-supplied URLs (the HLS proxy and resolver
// playability checks) must not reach private networks, including through a
// redirect or a DNS answer that changes between the check and the connection.
const MAX_REDIRECTS = 4;
// Viewers pull hundreds of segments a minute; one short-lived lookup shared by
// the check and the dispatcher keeps them from disagreeing.
const DNS_TTL_MS = 60_000;
const MAX_DNS_ENTRIES = 200;

// The pending lookup is what gets cached, not its result: a cold cache under a
// segment burst would otherwise fire one resolution per in-flight request.
type DnsEntry = { addresses: Promise<LookupAddress[]>; expiresAt: number };
const dnsCache = new Map<string, DnsEntry>();

function cachedLookup(hostname: string): Promise<LookupAddress[]> {
  const now = Date.now();
  const hit = dnsCache.get(hostname);
  if (hit && now < hit.expiresAt) return hit.addresses;

  const addresses = lookup(hostname, { all: true, verbatim: true });
  addresses.catch(() => {
    if (dnsCache.get(hostname)?.addresses === addresses) dnsCache.delete(hostname);
  });
  if (dnsCache.size >= MAX_DNS_ENTRIES) {
    for (const [key, entry] of dnsCache) if (now > entry.expiresAt) dnsCache.delete(key);
    for (const key of dnsCache.keys()) {
      if (dnsCache.size < MAX_DNS_ENTRIES) break;
      dnsCache.delete(key);
    }
  }
  dnsCache.set(hostname, { addresses, expiresAt: now + DNS_TTL_MS });
  return addresses;
}

export function getTargetUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function isBlockedIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIP(ip: string) {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family !== 6) return true;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return (
    v6 === "::1" ||
    v6 === "::" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    (mapped ? isBlockedIPv4(mapped[1]) : false)
  );
}

// WHATWG URL keeps the brackets on IPv6 literals; isIP and dns.lookup reject
// them, so strip them before either sees the host.
function bareHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "");
}

export async function isSafeHost(url: URL) {
  const hostname = bareHostname(url);
  if (isIP(hostname)) return !isBlockedIP(hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;

  try {
    const addresses = await cachedLookup(hostname);
    return addresses.length > 0 && addresses.every((addr) => !isBlockedIP(addr.address));
  } catch {
    return false;
  }
}

// Validates the addresses the socket actually connects to, so a DNS-rebinding
// answer cannot pass the pre-flight check and then hit a private IP.
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      void (async () => {
        try {
          const addresses = await cachedLookup(hostname);
          const safe = addresses.filter(
            (addr) =>
              !isBlockedIP(addr.address) && (!options.family || options.family === addr.family),
          );
          if (safe.length === 0) throw new Error("Blocked address.");
          if (options.all) callback(null, safe);
          else callback(null, safe[0].address as never, safe[0].family);
        } catch (error) {
          callback(error as NodeJS.ErrnoException, []);
        }
      })();
    },
  },
});

// The proxy trusts every hop for later segments and rescopes signed cookies to
// it. Resolver page requests only need the private-network checks, so they
// pass trustRedirects: false and leave the proxy's allowlist untouched.
export async function safeFetch(start: URL, init: RequestInit, { trustRedirects = true } = {}) {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual", dispatcher } as RequestInit);
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current };

    const location = response.headers.get("location");
    const next = location ? getTargetUrl(new URL(location, current).toString()) : null;
    if (!next || !(await isSafeHost(next))) throw new Error("Blocked redirect target.");
    const headers = new Headers(init.headers);
    if (trustRedirects) {
      // The hop came from an already-allowed host, so trust it for later segments.
      allowStreamHost(next, headers.get("referer") ?? undefined, streamUserAgent(current));
      // A signed cookie is scoped to a path; it must not follow a hop elsewhere.
      const cookie = streamCookie(next);
      if (cookie) headers.set("cookie", cookie);
      else headers.delete("cookie");
    } else if (next.origin !== current.origin) {
      headers.delete("cookie");
    }
    init = { ...init, headers };
    await response.body?.cancel();
    current = next;
  }

  throw new Error("Too many redirects.");
}

// For URLs a provider supplied: refuses private targets up front, then follows
// redirects through the same checks.
export async function fetchPublic(url: string | URL, init: RequestInit): Promise<Response> {
  const target = getTargetUrl(String(url));
  if (!target || !(await isSafeHost(target))) throw new Error("Blocked target.");
  return (await safeFetch(target, init, { trustRedirects: false })).response;
}
