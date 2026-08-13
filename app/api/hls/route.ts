import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";
import { allowStreamHost, isAllowedStreamHost } from "@/lib/hls-hosts";

const PLAYER_ORIGIN = "https://player.videasy.to";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;
// A single viewer pulls hundreds of segments a minute, and every one of them
// used to resolve the host twice: once in the pre-flight check and once in the
// dispatcher below. The window is short enough that a rebinding answer still
// expires quickly, and both call sites share it so they cannot disagree.
const DNS_TTL_MS = 60_000;
const MAX_DNS_ENTRIES = 200;
// Segment URLs are content-addressed and signed, so the bytes behind one never
// change. Playlists do change, but slowly enough to survive a seek.
const SEGMENT_CACHE_CONTROL = "public, max-age=3600, immutable";
const PLAYLIST_CACHE_CONTROL = "public, max-age=30";

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

function getTargetUrl(value: string | null) {
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

async function isSafeHost(url: URL) {
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

// The pre-flight check above and fetch would otherwise resolve the hostname
// twice, so a DNS-rebinding answer could return a public IP to the check and a
// private one to the connection. This dispatcher validates the addresses the
// socket actually connects to.
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

async function safeFetch(start: URL, init: RequestInit) {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual", dispatcher } as RequestInit);
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    const next = location ? getTargetUrl(new URL(location, current).toString()) : null;
    if (!next || !(await isSafeHost(next))) throw new Error("Blocked redirect target.");
    // The hop came from an already-allowed host, so trust it for later segments.
    allowStreamHost(next);
    current = next;
  }

  throw new Error("Too many redirects.");
}

function proxiedUrl(url: string | URL, requestUrl: string) {
  allowStreamHost(url);
  const proxyUrl = new URL("/api/hls", requestUrl);
  proxyUrl.searchParams.set("url", String(url));
  return `${proxyUrl.pathname}${proxyUrl.search}`;
}

function rewritePlaylist(text: string, targetUrl: URL, requestUrl: string) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${proxiedUrl(new URL(uri, targetUrl), requestUrl)}"`;
        });
      }
      return proxiedUrl(new URL(trimmed, targetUrl), requestUrl);
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const targetUrl = getTargetUrl(request.nextUrl.searchParams.get("url"));
  if (!targetUrl) return NextResponse.json({ error: "Invalid HLS URL." }, { status: 400 });
  if (!isAllowedStreamHost(targetUrl) || !(await isSafeHost(targetUrl))) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
  }

  const headers = new Headers({
    accept: request.headers.get("accept") ?? "*/*",
    origin: PLAYER_ORIGIN,
    referer: `${PLAYER_ORIGIN}/`,
    "user-agent": request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
  });
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(targetUrl, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
  } catch {
    return NextResponse.json({ error: "Upstream request failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseHeaders = new Headers();
  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  if (response.ok && (contentType.includes("mpegurl") || targetUrl.pathname.endsWith(".m3u8"))) {
    responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
    responseHeaders.set("cache-control", PLAYLIST_CACHE_CONTROL);
    responseHeaders.delete("content-length");
    return new NextResponse(await response.text().then((text) => rewritePlaylist(text, targetUrl, request.nextUrl.href)), {
      status: response.status,
      headers: responseHeaders,
    });
  }

  // Only cache bodies the upstream actually delivered: an error page must not
  // stick to a segment URL for an hour.
  if (response.status === 200 || response.status === 206) {
    responseHeaders.set("cache-control", SEGMENT_CACHE_CONTROL);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
