import { NextRequest, NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";

const MIN_QUERY_LENGTH = 2;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);

  if (!q || q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [], page: 1, totalPages: 0 });
  }

  try {
    const data = await searchMulti(q, page);
    const results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv",
    );

    return NextResponse.json(
      { results, page: data.page, totalPages: data.total_pages },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
