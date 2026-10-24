import { NextRequest, NextResponse } from "next/server";
import { allowCastHost, isValidCastToken } from "@/lib/cast-token";
import { allowStreamHost, isAllowedStreamHost, streamReferer } from "@/lib/hls-hosts";
import { getTargetUrl, isSafeHost, safeFetch } from "@/lib/safe-fetch";
import { API_CSP } from "@/lib/security-headers";
import { srtToVtt } from "@/lib/srt";
import { unwrapTransportStream } from "@/lib/transport-stream";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
// Signed segment URLs have stable bytes; playlists can change, so cache them only briefly.
const SEGMENT_CACHE_CONTROL = "public, max-age=3600, immutable";
const PLAYLIST_CACHE_CONTROL = "public, max-age=30";
// Sniff bounded text/image bodies for disguised segments or playlists; stream larger bodies through.
const MAX_SNIFF_BYTES = 32 * 1024 * 1024;
// Feature-length SRT files are a few hundred KB.
const MAX_SUBTITLE_BYTES = 4 * 1024 * 1024;

function proxyError(error: string, status: number, headers: Headers) {
  const responseHeaders = new Headers(headers);
  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    responseHeaders.delete(header);
  }
  responseHeaders.set("cache-control", "no-store");
  return NextResponse.json({ error }, { status, headers: responseHeaders });
}

function proxiedUrl(
  url: string | URL,
  requestUrl: string,
  castToken: string | null,
  parentUrl: URL,
  referer?: string,
) {
  allowStreamHost(url, referer);
  if (castToken && !allowCastHost(castToken, new URL(requestUrl).host, parentUrl.host, new URL(url).host)) {
    throw new Error("Invalid Cast target.");
  }
  const proxyUrl = new URL("/api/hls", requestUrl);
  proxyUrl.searchParams.set("url", String(url));
  if (castToken) proxyUrl.searchParams.set("castToken", castToken);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
}

function rewritePlaylist(
  text: string,
  targetUrl: URL,
  requestUrl: string,
  castToken: string | null,
  referer?: string,
) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${proxiedUrl(new URL(uri, targetUrl), requestUrl, castToken, targetUrl, referer)}"`;
        });
      }
      return proxiedUrl(new URL(trimmed, targetUrl), requestUrl, castToken, targetUrl, referer);
    })
    .join("\n");
}

// Bound chunked reads independently of content-length and enforce a body deadline.
// The fetch timeout ends at headers; return null when either body limit is exceeded.
async function readBytes(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, FETCH_TIMEOUT_MS);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) return null;
      if (done) {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      }
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getCastCorsHeaders(request: NextRequest, castToken: string | null) {
  const target = getTargetUrl(request.nextUrl.searchParams.get("url"));
  if (!target || !castToken || !isValidCastToken(castToken, request.nextUrl.host, target.host)) return null;
  const origin = request.headers.get("origin");
  if (!origin) return new Headers();

  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }

  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-expose-headers":
      "accept-ranges, content-length, content-range, content-type",
    vary: "Origin",
  });
}

export function OPTIONS(request: NextRequest) {
  const targetUrl = getTargetUrl(request.nextUrl.searchParams.get("url"));
  const castToken = request.nextUrl.searchParams.get("castToken");
  const headers = getCastCorsHeaders(request, castToken);
  if (!targetUrl || !isAllowedStreamHost(targetUrl) || !headers) {
    return new NextResponse(null, { status: 403, headers: {
      "content-security-policy": API_CSP,
      "x-content-type-options": "nosniff",
    } });
  }

  headers.set("content-security-policy", API_CSP);
  headers.set("x-content-type-options", "nosniff");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Accept-Encoding, Content-Type, Range");
  headers.set("access-control-max-age", "300");
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  const responseHeaders = new Headers({
    "content-security-policy": API_CSP,
    "x-content-type-options": "nosniff",
  });
  const targetUrl = getTargetUrl(request.nextUrl.searchParams.get("url"));
  const castToken = request.nextUrl.searchParams.get("castToken");
  const castHeaders = getCastCorsHeaders(request, castToken);
  if (castToken && !castHeaders) {
    return proxyError("Invalid Cast token.", 403, responseHeaders);
  }
  if (!targetUrl) return proxyError("Invalid HLS URL.", 400, responseHeaders);
  if (!isAllowedStreamHost(targetUrl) || !(await isSafeHost(targetUrl))) {
    return proxyError("Target host is not allowed.", 403, responseHeaders);
  }

  const referer = streamReferer(targetUrl);
  const headers = new Headers({
    accept: request.headers.get("accept") ?? "*/*",
    "user-agent": request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
  });
  if (referer) {
    headers.set("origin", new URL(referer).origin);
    headers.set("referer", referer);
  }
  // SRT is converted whole, so its requests never ask upstream for a range.
  const srt = request.nextUrl.searchParams.get("format") === "srt";
  const range = srt ? null : request.headers.get("range");
  if (range) headers.set("range", range);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  let finalUrl: URL;
  try {
    ({ response, finalUrl } = await safeFetch(targetUrl, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    }));
  } catch {
    return proxyError("Upstream request failed.", 502, responseHeaders);
  } finally {
    clearTimeout(timeout);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (castToken && !allowCastHost(castToken, request.nextUrl.host, targetUrl.host, finalUrl.host)) {
    await response.body?.cancel();
    return proxyError("Invalid Cast token.", 403, responseHeaders);
  }
  if (["text/html", "application/xhtml+xml", "image/svg+xml"].includes(contentType)) {
    await response.body?.cancel();
    return proxyError("Upstream request failed.", 502, responseHeaders);
  }
  if (!response.ok) {
    await response.body?.cancel();
    return proxyError("Upstream request failed.", 502, responseHeaders);
  }
  if (castHeaders) {
    for (const [key, value] of castHeaders) responseHeaders.set(key, value);
  }
  // format=srt requests conversion to WebVTT for <track> and Cast.
  if (srt) {
    const bytes = await readBytes(response, MAX_SUBTITLE_BYTES);
    if (bytes === null) {
      return proxyError("Upstream request failed.", 502, responseHeaders);
    }
    responseHeaders.set("content-type", "text/vtt; charset=utf-8");
    responseHeaders.set("cache-control", castToken ? "no-store" : SEGMENT_CACHE_CONTROL);
    return new NextResponse(srtToVtt(new TextDecoder().decode(bytes)), { headers: responseHeaders });
  }
  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  // Upstream MIME types can disguise playlists as HTML or segments as images; inspect their bytes.
  const expectsPlaylist = contentType.includes("mpegurl") || /\.(?:m3u8|txt)$/i.test(finalUrl.pathname);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  const allowedMedia = /^(?:video|audio)\/[a-z0-9.+-]+$/.test(contentType) || [
    "application/octet-stream", "application/vnd.apple.mpegurl", "application/x-mpegurl",
    "application/dash+xml", "text/vtt",
  ].includes(contentType);
  const sniff =
    response.ok &&
    (!range || response.status === 200) &&
    contentLength <= MAX_SNIFF_BYTES &&
    (expectsPlaylist || !contentType || contentType === "application/octet-stream" || /^(?:text|image)\/|javascript|json/i.test(contentType));
  if (sniff) {
    const bytes = await readBytes(response, MAX_SNIFF_BYTES);
    if (!bytes) {
      return proxyError("Upstream request failed.", 502, responseHeaders);
    }
    const text = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^\uFEFF/, "").trimStart();
    if (text.startsWith("#EXTM3U")) {
      responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
      responseHeaders.set("cache-control", castToken ? "no-store" : PLAYLIST_CACHE_CONTROL);
      responseHeaders.delete("content-length");
      const playlist = new TextDecoder().decode(bytes);
      try {
        return new NextResponse(
          rewritePlaylist(playlist, finalUrl, request.nextUrl.href, castToken, referer),
          { status: response.status, headers: responseHeaders },
        );
      } catch {
        return proxyError("Invalid upstream playlist.", 502, responseHeaders);
      }
    }
    const segment = unwrapTransportStream(bytes);
    if (segment) {
      responseHeaders.set("content-type", "video/mp2t");
      responseHeaders.set("content-length", String(segment.byteLength));
      responseHeaders.set("cache-control", castToken ? "no-store" : SEGMENT_CACHE_CONTROL);
      return new NextResponse(segment, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    if (!contentType && /^WEBVTT(?:\s|$)/.test(text)) {
      responseHeaders.set("content-type", "text/vtt");
      responseHeaders.set("cache-control", castToken ? "no-store" : SEGMENT_CACHE_CONTROL);
      return new NextResponse(bytes, { status: response.status, headers: responseHeaders });
    }
    // Never serve an upstream HTML page from this origin.
    if (expectsPlaylist || !allowedMedia || /^(?:<!doctype\b|<!--|<\?xml\b|<(?:html|head|body|script|iframe|svg)\b)/i.test(text)) {
      return proxyError("Invalid upstream media.", 502, responseHeaders);
    }
    responseHeaders.set("cache-control", castToken ? "no-store" : SEGMENT_CACHE_CONTROL);
    return new NextResponse(bytes, { status: response.status, headers: responseHeaders });
  }

  if (!allowedMedia) {
    await response.body?.cancel();
    return proxyError("Invalid upstream media.", 502, responseHeaders);
  }

  // Never cache upstream errors under segment URLs.
  if (response.status === 200 || response.status === 206) {
    responseHeaders.set("cache-control", castToken ? "no-store" : SEGMENT_CACHE_CONTROL);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
