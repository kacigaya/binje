import { NextRequest, NextResponse } from "next/server";
import { isValidCastToken } from "@/lib/cast-token";
import { type Manifest, masterPlaylist, mediaPlaylist, parseMpd } from "@/lib/dash-to-hls";
import { allowStreamHost, isAllowedStreamHost, streamCookie, streamReferer, streamUserAgent } from "@/lib/hls-hosts";
import { getTargetUrl, isSafeHost, safeFetch } from "@/lib/safe-fetch";
import { unwrapTransportStream } from "@/lib/transport-stream";
import { createTtlCache } from "@/lib/ttl-cache";

const PLAYER_ORIGIN = "https://player.videasy.to";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
// Segment URLs are content-addressed and signed, so the bytes behind one never
// change. Playlists do change, but slowly enough to survive a seek.
const SEGMENT_CACHE_CONTROL = "public, max-age=3600, immutable";
const PLAYLIST_CACHE_CONTROL = "public, max-age=30";
// A DASH manifest becomes one master plus one media playlist per
// representation; the parsed manifest is shared between those requests.
const MANIFEST_TTL_MS = 60_000;
const manifestCache = createTtlCache<Manifest>(MANIFEST_TTL_MS);
// Bodies labelled as text or images are read whole to tell playlists from
// disguised segments; those are a few MB, so anything larger streams through.
const MAX_SNIFF_BYTES = 32 * 1024 * 1024;
function proxiedUrl(
  url: string | URL,
  requestUrl: string,
  castToken: string | null,
  referer?: string,
  userAgent?: string,
) {
  allowStreamHost(url, referer, userAgent);
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
  userAgent?: string,
) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${proxiedUrl(new URL(uri, targetUrl), requestUrl, castToken, referer, userAgent)}"`;
        });
      }
      return proxiedUrl(new URL(trimmed, targetUrl), requestUrl, castToken, referer, userAgent);
    })
    .join("\n");
}

// DASH is served as HLS: the manifest URL answers with a master playlist and
// `rep=<id>` selects the media playlist of one representation. Segments go
// through the regular proxy path, so the cookie scope and host allowlist apply.
async function serveDashAsHls(
  request: NextRequest,
  targetUrl: URL,
  headers: Headers,
  castToken: string | null,
  castHeaders: Headers | null,
  rep: string | null,
) {
  if (rep !== null && !/^[\w-]{1,32}$/.test(rep)) {
    return NextResponse.json({ error: "Invalid representation." }, { status: 400 });
  }
  let manifest: Manifest;
  try {
    manifest = await manifestCache.get(targetUrl.href, async () => {
      const { response, finalUrl } = await safeFetch(targetUrl, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Upstream manifest failed.");
      }
      return parseMpd(await response.text(), finalUrl);
    });
  } catch {
    return NextResponse.json({ error: "Invalid upstream manifest." }, { status: 502 });
  }

  return renderDashAsHls(request, targetUrl, manifest, castToken, castHeaders, rep);
}

function renderDashAsHls(
  request: NextRequest,
  targetUrl: URL,
  manifest: Manifest,
  castToken: string | null,
  castHeaders: Headers | null,
  rep: string | null,
) {

  const referer = streamReferer(targetUrl);
  const userAgent = streamUserAgent(targetUrl);
  let body: string;
  if (rep === null) {
    body = masterPlaylist(manifest, (representation) => {
      const variant = new URL("/api/hls", request.nextUrl.href);
      variant.searchParams.set("url", targetUrl.href);
      variant.searchParams.set("rep", representation.id);
      if (castToken) variant.searchParams.set("castToken", castToken);
      return `${variant.pathname}${variant.search}`;
    });
  } else {
    const representation = [...manifest.video, ...manifest.audio].find((item) => item.id === rep);
    if (!representation) return NextResponse.json({ error: "Unknown representation." }, { status: 404 });
    body = mediaPlaylist(representation, (url) =>
      proxiedUrl(url, request.nextUrl.href, castToken, referer, userAgent),
    );
  }

  const responseHeaders = new Headers({
    "content-security-policy": "default-src 'none'; sandbox",
    "x-content-type-options": "nosniff",
    "content-type": "application/vnd.apple.mpegurl",
    "cache-control": PLAYLIST_CACHE_CONTROL,
  });
  if (castHeaders) {
    for (const [key, value] of castHeaders) responseHeaders.set(key, value);
  }
  return new NextResponse(body, { headers: responseHeaders });
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

  const referer = streamReferer(targetUrl) ?? `${PLAYER_ORIGIN}/`;
  const pinnedUserAgent = streamUserAgent(targetUrl);
  const headers = new Headers({
    accept: request.headers.get("accept") ?? "*/*",
    origin: new URL(referer).origin,
    referer,
    "user-agent": pinnedUserAgent ?? request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
  });
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  const cookie = streamCookie(targetUrl);
  if (cookie) headers.set("cookie", cookie);
  const rep = request.nextUrl.searchParams.get("rep");
  if (targetUrl.pathname.endsWith(".mpd") || rep !== null) {
    return serveDashAsHls(request, targetUrl, headers, castToken, castHeaders, rep);
  }

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
  const mayBeDash =
    response.ok &&
    !range &&
    !/\.(?:m4s|mp4|m4a|ts|aac|vtt|srt)$/i.test(finalUrl.pathname) &&
    (contentType.includes("xml") || contentType.includes("dash") || contentType.includes("application/octet-stream"));
  if (mayBeDash) {
    const text = await response.clone().text();
    const start = text.trimStart();
    if (start.startsWith("<?xml") || start.startsWith("<MPD")) {
      if (!text.includes("<MPD")) {
        return NextResponse.json({ error: "Invalid upstream manifest." }, { status: 502 });
      }
      try {
        const manifest = await manifestCache.get(finalUrl.href, async () => parseMpd(text, finalUrl));
        return renderDashAsHls(request, finalUrl, manifest, castToken, castHeaders, null);
      } catch {
        return NextResponse.json({ error: "Invalid upstream manifest." }, { status: 502 });
      }
    }
  }
  const responseHeaders = new Headers({
    "content-security-policy": "default-src 'none'; sandbox",
    "x-content-type-options": "nosniff",
  });
  if (castHeaders) {
    for (const [key, value] of castHeaders) responseHeaders.set(key, value);
  }
  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  // Playlists arrive as text/plain, javascript or HTML, and segments as PNG or
  // JPEG, so labelled-as-text-or-image bodies are judged by their bytes.
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
        rewritePlaylist(playlist, finalUrl, request.nextUrl.href, castToken, referer, pinnedUserAgent),
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
