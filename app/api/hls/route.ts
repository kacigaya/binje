import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { isSignedProxyRequest, proxyUrl } from "@/lib/hls-token";
import { isLibraryObject, presignGet, storageConfigFromEnv } from "@/lib/storage";

const PLAYER_ORIGIN = "https://player.videasy.to";
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

/** Segment and key URLs are rewritten through this proxy, freshly signed. */
async function proxied(url: string | URL, requestUrl: string) {
  const signed = new URL(await proxyUrl(requestUrl, String(url)));
  return `${signed.pathname}${signed.search}`;
}

const URI_ATTRIBUTE = /URI="([^"]+)"/g;

async function rewritePlaylist(text: string, targetUrl: URL, requestUrl: string) {
  const lines = await Promise.all(
    text.split("\n").map(async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith("#")) {
        return proxied(new URL(trimmed, targetUrl), requestUrl);
      }
      // Signing is async, so collect the rewritten URIs before substituting.
      const signed = await Promise.all(
        [...line.matchAll(URI_ATTRIBUTE)].map(([, uri]) =>
          proxied(new URL(uri, targetUrl), requestUrl),
        ),
      );
      let index = 0;
      return line.replace(URI_ATTRIBUTE, () => `URI="${signed[index++]}"`);
    }),
  );
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const rawTarget = query.get("url");
  const targetUrl = getTargetUrl(rawTarget);
  if (!targetUrl) return NextResponse.json({ error: "Invalid HLS URL." }, { status: 400 });

  const storage = storageConfigFromEnv();
  const onStorageHost =
    storage !== null && new URL(storage.endpoint).host === targetUrl.host;

  // Only targets minted by our own resolvers are fetched. Otherwise the proxy
  // is an open relay: any caller could route traffic through our egress.
  const signed = await isSignedProxyRequest(
    rawTarget!,
    query.get("exp"),
    query.get("sig"),
  );
  // ponytail: unsigned library objects still pass so mobile builds shipped
  // before signing keep playing; that set is closed and checked below anyway.
  // Drop this branch once those clients are gone.
  if (!signed && !onStorageHost) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
  }

  if (!(await isSafeHost(targetUrl))) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
  }

  // Library objects are private: sign them here so credentials stay server-side.
  // Anything else on the storage host is refused rather than signed blindly.
  if (onStorageHost && !isLibraryObject(storage, targetUrl)) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
  }
  const fetchUrl = onStorageHost
    ? new URL(await presignGet(storage, targetUrl.toString()))
    : targetUrl;

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
    response = await safeFetch(fetchUrl, {
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
    const playlist = await rewritePlaylist(
      await response.text(),
      targetUrl,
      request.nextUrl.href,
    );
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
