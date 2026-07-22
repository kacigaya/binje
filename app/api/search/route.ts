import { NextRequest, NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
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
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Netlify-Vary": "query",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
