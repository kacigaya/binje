import { NextRequest, NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const requestedLocale = request.nextUrl.searchParams.get("lang") ?? "";
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;

  if (!q || q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [], page: 1, totalPages: 0 });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  if (!Number.isFinite(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  try {
    const data = await searchMulti(q, page, locale);
    const results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv",
    );

    return NextResponse.json(
      { results, page: data.page, totalPages: data.total_pages },
      {
        headers: {
          // Vary the CDN cache on the query string; without this Netlify's
          // durable cache keys only on Next internals and serves one cached
          // response for every q. Upstream TMDB calls stay cached via the
          // Next data cache (revalidate in tmdbFetch).
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Netlify-Vary": "query",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
