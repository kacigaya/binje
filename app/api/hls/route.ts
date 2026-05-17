import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PLAYER_ORIGIN = "https://player.videasy.net";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;

function getTargetUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

// Blocks private, loopback, link-local, CGNAT, multicast and reserved ranges.
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 reserved
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true; // loopback / unspecified
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique local
  if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) {
    return true; // link-local
  }
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

function isBlockedIP(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}

// Resolves the host and rejects any address that targets internal infrastructure.
async function isSafeHost(url: URL): Promise<boolean> {
  const host = url.hostname;
  if (!host) return false;

  if (isIP(host)) return !isBlockedIP(host);

  if (host === "localhost" || host.endsWith(".localhost")) return false;

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((addr) => !isBlockedIP(addr.address));
  } catch {
    return false;
  }
}

// Follows redirects manually so every hop is re-validated against SSRF rules.
async function safeFetch(start: URL, init: RequestInit): Promise<Response> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual" });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) return response;

    const next = getTargetUrl(new URL(location, current).toString());
    if (!next || !(await isSafeHost(next))) {
      throw new Error("Blocked redirect target.");
    }
    current = next;
  }

  throw new Error("Too many redirects.");
}

function proxiedUrl(url: string | URL, requestUrl: string) {
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
          const resolvedUrl = new URL(uri, targetUrl);
          return `URI="${proxiedUrl(resolvedUrl, requestUrl)}"`;
        });
      }

      return proxiedUrl(new URL(trimmed, targetUrl), requestUrl);
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const targetUrl = getTargetUrl(request.nextUrl.searchParams.get("url"));

  if (!targetUrl) {
    return NextResponse.json({ error: "Invalid HLS URL." }, { status: 400 });
  }

  if (!(await isSafeHost(targetUrl))) {
    return NextResponse.json(
      { error: "Target host is not allowed." },
      { status: 403 },
    );
  }

  const headers = new Headers({
    accept: request.headers.get("accept") ?? "*/*",
    origin: PLAYER_ORIGIN,
    referer: `${PLAYER_ORIGIN}/`,
    "user-agent": request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
  });

  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  // Timeout guards connection + time-to-first-byte; body streaming is left uncapped.
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
    return NextResponse.json(
      { error: "Upstream request failed." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseHeaders = new Headers();

  for (const header of [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
  ]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  if (
    response.ok &&
    (contentType.includes("mpegurl") || targetUrl.pathname.endsWith(".m3u8"))
  ) {
    const playlist = rewritePlaylist(
      await response.text(),
      targetUrl,
      request.nextUrl.href,
    );

    responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
    responseHeaders.delete("content-length");

    return new NextResponse(playlist, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
