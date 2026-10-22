import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import { allowStreamHost } from "@/lib/hls-hosts";

// Provider URLs must never reach private networks, including through redirects or DNS rebinding.
const MAX_REDIRECTS = 4;
// Share short-lived DNS lookups between checks and connections to keep segment bursts consistent.
const DNS_TTL_MS = 60_000;
const MAX_DNS_ENTRIES = 200;

// Cache pending lookups so concurrent cold-cache requests share one DNS resolution.
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
  let v6: string;
  try {
    v6 = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  } catch { return true; }
  // WHATWG URLs normalize mapped IPv4 literals to two hexadecimal groups.
  const mappedHex = v6.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isBlockedIPv4(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  return (
    /^::[0-9a-f]{0,4}$/.test(v6) ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  );
}

// Strip WHATWG URL's IPv6 brackets before passing the host to isIP or dns.lookup.
function bareHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "");
}

async function lookupWithSignal(hostname: string, signal?: AbortSignal): Promise<LookupAddress[]> {
  signal?.throwIfAborted();
  const addresses = cachedLookup(hostname);
  if (!signal) return addresses;
  return new Promise((resolve, reject) => {
    const abort = () => {
      if (dnsCache.get(hostname)?.addresses === addresses) dnsCache.delete(hostname);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    addresses.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

export async function isSafeHost(url: URL, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const hostname = bareHostname(url);
  if (isIP(hostname)) return !isBlockedIP(hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;

  try {
    const addresses = await lookupWithSignal(hostname, signal);
    return addresses.length > 0 && addresses.every((addr) => !isBlockedIP(addr.address));
  } catch {
    signal?.throwIfAborted();
    return false;
  }
}

// Validate socket addresses too; DNS rebinding can bypass a pre-flight check.
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

// Proxy redirects register their target host, with the same Referer, for later segments.
// Resolvers use trustRedirects: false to keep network checks without changing the proxy allowlist.
export async function safeFetch(start: URL, init: RequestInit, { trustRedirects = true } = {}) {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      dispatcher,
    } as RequestInit);
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current };

    const location = response.headers.get("location");
    const next = location ? getTargetUrl(new URL(location, current).toString()) : null;
    if (!next || !(await isSafeHost(next, init.signal ?? undefined))) throw new Error("Blocked redirect target.");
    // The hop came from an already-allowed host, so trust it for later segments.
    if (trustRedirects) allowStreamHost(next, new Headers(init.headers).get("referer") ?? undefined);
    await response.body?.cancel();
    current = next;
  }

  throw new Error("Too many redirects.");
}

// Apply private-network checks to provider URLs and every redirect.
export async function fetchPublic(url: string | URL, init: RequestInit): Promise<Response> {
  const target = getTargetUrl(String(url));
  if (!target || !(await isSafeHost(target, init.signal ?? undefined))) throw new Error("Blocked target.");
  // Slot resolvers inspect redirects before deciding which hosters to fetch.
  if (init.redirect === "manual") {
    return fetch(target, { ...init, redirect: "manual", dispatcher } as RequestInit);
  }
  return (await safeFetch(target, init, { trustRedirects: false })).response;
}
