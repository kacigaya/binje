import { NextRequest, NextResponse } from "next/server";
import { isValidCastToken } from "@/lib/cast-token";
import { allowStreamHost, isAllowedStreamHost, streamReferer } from "@/lib/hls-hosts";
import { getTargetUrl, isSafeHost, safeFetch } from "@/lib/safe-fetch";
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
function proxiedUrl(
  url: string | URL,
  requestUrl: string,
  castToken: string | null,
  referer?: string,
) {
  allowStreamHost(url, referer);
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
          return `URI="${proxiedUrl(new URL(uri, targetUrl), requestUrl, castToken, referer)}"`;
        });
      }
      return proxiedUrl(new URL(trimmed, targetUrl), requestUrl, castToken, referer);
    })
    .join("\n");
}

// Bound chunked reads independently of content-length and enforce a body deadline.
// The fetch timeout ends at headers; return null when either body limit is exceeded.
async function readSubtitle(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, FETCH_TIMEOUT_MS);
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) return null;
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > MAX_SUBTITLE_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getCastCorsHeaders(request: NextRequest, castToken: string | null) {
  if (!castToken || !isValidCastToken(castToken)) return null;
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
    return new NextResponse(null, { status: 403 });
  }

  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Accept-Encoding, Content-Type, Range");
  headers.set("access-control-max-age", "600");
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  const targetUrl = getTargetUrl(request.nextUrl.searchParams.get("url"));
  const castToken = request.nextUrl.searchParams.get("castToken");
  const castHeaders = getCastCorsHeaders(request, castToken);
  if (castToken && !castHeaders) {
    return NextResponse.json({ error: "Invalid Cast token." }, { status: 403 });
  }
  if (!targetUrl) return NextResponse.json({ error: "Invalid HLS URL." }, { status: 400 });
  if (!isAllowedStreamHost(targetUrl) || !(await isSafeHost(targetUrl))) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
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
    return NextResponse.json({ error: "Upstream request failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok && contentType.includes("text/html")) {
    await response.body?.cancel();
    return NextResponse.json({ error: "Upstream request failed." }, { status: 502 });
  }
  const responseHeaders = new Headers({
    "content-security-policy": "default-src 'none'; sandbox",
    "x-content-type-options": "nosniff",
  });
  if (castHeaders) {
    for (const [key, value] of castHeaders) responseHeaders.set(key, value);
  }
  // format=srt requests conversion to WebVTT for <track> and Cast.
  if (srt) {
    if (!response.ok) await response.body?.cancel();
    const text = response.ok ? await readSubtitle(response) : null;
    if (text === null) {
      return NextResponse.json({ error: "Upstream request failed." }, { status: 502 });
    }
    responseHeaders.set("content-type", "text/vtt; charset=utf-8");
    responseHeaders.set("cache-control", SEGMENT_CACHE_CONTROL);
    return new NextResponse(srtToVtt(text), { headers: responseHeaders });
  }
  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  // Upstream MIME types can disguise playlists as HTML or segments as images; inspect their bytes.
  const expectsPlaylist = contentType.includes("mpegurl") || /\.(?:m3u8|txt)$/i.test(finalUrl.pathname);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  const sniff =
    response.ok &&
    !range &&
    contentLength <= MAX_SNIFF_BYTES &&
    (expectsPlaylist || /^(?:text|image)\/|javascript|json/i.test(contentType));
  if (sniff) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder().decode(bytes.subarray(0, 64)).replace(/^\uFEFF/, "").trimStart();
    if (text.startsWith("#EXTM3U")) {
      responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
      responseHeaders.set("cache-control", PLAYLIST_CACHE_CONTROL);
      responseHeaders.delete("content-length");
      const playlist = new TextDecoder().decode(bytes);
      return new NextResponse(
        rewritePlaylist(playlist, finalUrl, request.nextUrl.href, castToken, referer),
        { status: response.status, headers: responseHeaders },
      );
    }
    const segment = unwrapTransportStream(bytes);
    if (segment) {
      responseHeaders.set("content-type", "video/mp2t");
      responseHeaders.set("content-length", String(segment.byteLength));
      responseHeaders.set("cache-control", SEGMENT_CACHE_CONTROL);
      return new NextResponse(segment, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    // Never serve an upstream HTML page from this origin.
    if (expectsPlaylist || contentType.includes("html")) {
      return NextResponse.json({ error: "Invalid upstream playlist." }, { status: 502 });
    }
    responseHeaders.set("cache-control", SEGMENT_CACHE_CONTROL);
    return new NextResponse(bytes, { status: response.status, headers: responseHeaders });
  }

  // Never cache upstream errors under segment URLs.
  if (response.status === 200 || response.status === 206) {
    responseHeaders.set("cache-control", SEGMENT_CACHE_CONTROL);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
