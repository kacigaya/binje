import { NextRequest, NextResponse } from "next/server";
import { scrapeM3u8 } from "./uqload";

const FREMBED_ORIGIN = "https://frembed.hair";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export const runtime = "nodejs";
export const maxDuration = 20;

const BASE_HEADERS = {
  "user-agent": BROWSER_USER_AGENT,
  referer: `${FREMBED_ORIGIN}/`,
};

async function resolveHoster(streamPath: string): Promise<string | null> {
  const res = await fetch(`${FREMBED_ORIGIN}${streamPath}`, {
    headers: BASE_HEADERS,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  return res.headers.get("location");
}

async function extractFromHoster(embedUrl: string): Promise<string | null> {
  const origin = new URL(embedUrl).origin;
  const html = await fetch(embedUrl, {
    headers: { ...BASE_HEADERS, referer: `${origin}/` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.text());
  const url = scrapeM3u8(html);
  return url && (await isPlayable(url, origin)) ? url : null;
}

async function isPlayable(url: string, referer: string) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_USER_AGENT, referer: `${referer}/` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    return (await res.text()).trimStart().startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

async function extract(
  type: "movie" | "tv",
  id: string,
  season: string,
  episode: string,
) {
  const listUrl =
    type === "tv"
      ? `${FREMBED_ORIGIN}/api/series?id=${id}&sa=${season}&epi=${episode}&idType=tmdb`
      : `${FREMBED_ORIGIN}/api/films?id=${id}&idType=tmdb`;
  const meta = (await fetch(listUrl, {
    headers: BASE_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.json())) as Record<string, string | null>;

  const paths = Array.from({ length: 7 }, (_, i) => meta[`link${i + 1}`])
    .filter((p): p is string => Boolean(p));
  if (!paths.length) throw new Error("No VF servers available.");

  for (const path of paths) {
    const hoster = await resolveHoster(path);
    if (!hoster) continue;
    const url = await extractFromHoster(hoster).catch(() => null);
    if (url) return { url, tracks: [] as [] };
  }
  throw new Error("No VF server returned a stream.");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = q.get("type");
  const id = q.get("id");
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id ?? "")) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  const season = q.get("season") ?? "1";
  const episode = q.get("episode") ?? "1";
  if (type === "tv" && !(/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode))) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const result = await extract(type, id!, season, episode);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve VF stream." },
      { status: 502 },
    );
  }
}
