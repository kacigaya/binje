import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "player.videasy.net";

function isAllowedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === ALLOWED_HOST;
  } catch {
    return false;
  }
}

function injectBaseTag(html: string) {
  if (/<base\s/i.test(html)) return html;
  return html.replace(
    /<head(.*?)>/i,
    `<head$1><base href="https://${ALLOWED_HOST}/">`,
  );
}

function stripAdScripts(html: string) {
  return html
    .replace(
      /<script[^>]+src=["'][^"']*\/scripts\/ab\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    )
    .replace(
      /<script[^>]+src=["'][^"']*users\.videasy\.net\/api\/script\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    );
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");

  if (!src || !isAllowedSource(src)) {
    return new NextResponse("Invalid source", { status: 400 });
  }

  const upstream = await fetch(src, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!upstream.ok) {
    return new NextResponse("Failed to load source", { status: 502 });
  }

  const html = await upstream.text();
  const cleaned = injectBaseTag(stripAdScripts(html));

  return new NextResponse(cleaned, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
