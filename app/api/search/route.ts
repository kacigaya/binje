import { NextRequest, NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  const data = await searchMulti(q);
  const results = data.results.filter(
    (r) => r.media_type === "movie" || r.media_type === "tv",
  );
  return NextResponse.json({ results });
}
