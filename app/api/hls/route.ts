import { NextRequest, NextResponse } from "next/server";

const PLAYER_ORIGIN = "https://player.videasy.net";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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

  const headers = new Headers({
    accept: request.headers.get("accept") ?? "*/*",
    origin: PLAYER_ORIGIN,
    referer: `${PLAYER_ORIGIN}/`,
    "user-agent": request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
  });

  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const response = await fetch(targetUrl, {
    cache: "no-store",
    headers,
  });

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

  responseHeaders.set("access-control-allow-origin", "*");

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
