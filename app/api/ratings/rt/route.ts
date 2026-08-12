import { NextRequest, NextResponse } from "next/server";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";

const IMDB_ID_PATTERN = /^tt\d+$/;

export async function GET(request: NextRequest) {
  const imdbId = request.nextUrl.searchParams.get("imdbId");
  if (!imdbId || !IMDB_ID_PATTERN.test(imdbId)) {
    return NextResponse.json({ score: null }, { status: 400 });
  }
  const score = await getRottenTomatoesScore(imdbId);
  return NextResponse.json({ score }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
