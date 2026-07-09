import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

const PLAYER_ORIGIN = "https://vidcore.net";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;

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

async function isSafeHost(url: URL) {
  if (isIP(url.hostname)) return !isBlockedIP(url.hostname);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) return false;

  try {
    const addresses = await lookup(url.hostname, { all: true });
    return addresses.length > 0 && addresses.every((addr) => !isBlockedIP(addr.address));
  } catch {
    return false;
  }
}

async function safeFetch(start: URL, init: RequestInit) {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    const next = location ? getTargetUrl(new URL(location, current).toString()) : null;
    if (!next || !(await isSafeHost(next))) throw new Error("Blocked redirect target.");
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
  if (!(await isSafeHost(targetUrl))) {
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
    responseHeaders.delete("content-length");
    return new NextResponse(await response.text().then((text) => rewritePlaylist(text, targetUrl, request.nextUrl.href)), {
      status: response.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
