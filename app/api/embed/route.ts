import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_PLAYER_HOST,
  PLAYER_BASE,
  rewriteEmbedHtml,
} from "@/lib/embed-proxy";

export const runtime = "nodejs";
export const maxDuration = 20;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;

function getVideasyUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== ALLOWED_PLAYER_HOST) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const target = getVideasyUrl(request.nextUrl.searchParams.get("url"));
  if (!target) {
    return NextResponse.json(
      { error: "Invalid or disallowed player URL." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(target, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": BROWSER_USER_AGENT,
        referer: PLAYER_BASE,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load player." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Player upstream error." }, { status: 502 });
  }

  const html = rewriteEmbedHtml(
    await response.text(),
    `${target.pathname}${target.search}${target.hash}`,
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "frame-ancestors 'self';",
    },
  });
}
