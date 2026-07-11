import { NextRequest, NextResponse } from "next/server";
import { extractM3u8 } from "./uqload";

// French (VF) stream resolver via frembed. Unlike vidcore, frembed does not
// serve HLS directly: its /api/stream endpoints 302 to third-party file
// hosters. This only handles uqload, which exposes a clean signed HLS
// master.m3u8 that binje's native player consumes. Other hosters
// (playmogo, netu, direct-mp4 frvod) are skipped.
// ponytail: uqload-only. Add playmogo/netu/mp4 extractors if uqload coverage
// proves too thin — each needs its own scraper, so add on demand, not upfront.
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

async function extractFromUqload(embedUrl: string): Promise<string | null> {
  const html = await fetch(embedUrl, {
    headers: BASE_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.text());
  const url = extractM3u8(html);
  return url && (await isPlayable(url)) ? url : null;
}

async function isPlayable(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_USER_AGENT, referer: "https://uqload.is/" },
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

  // link1..link7 are the VF servers. Probe in order.
  const paths = Array.from({ length: 7 }, (_, i) => meta[`link${i + 1}`])
    .filter((p): p is string => Boolean(p));
  if (!paths.length) throw new Error("No VF servers available.");

  for (const path of paths) {
    const hoster = await resolveHoster(path);
    if (!hoster || !/uqload\.\w+\/embed-/.test(hoster)) continue;
    const url = await extractFromUqload(hoster);
    if (url) return { url, tracks: [] as [] };
  }
  throw new Error("No uqload server returned a stream.");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = q.get("type");
  const id = q.get("id");
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id ?? "")) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const result = await extract(
      type,
      id!,
      q.get("season") ?? "1",
      q.get("episode") ?? "1",
    );
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
