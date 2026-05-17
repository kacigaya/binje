import { NextRequest, NextResponse } from "next/server";
import { getSeasonEpisodes } from "@/lib/tmdb";

function getPositiveInt(value: string | null): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const showId = getPositiveInt(params.get("showId"));
  const seasonRaw = Number(params.get("season"));
  const season = Number.isInteger(seasonRaw) && seasonRaw >= 0 ? seasonRaw : null;

  if (!showId || season === null) {
    return NextResponse.json(
      { error: "Missing showId or season." },
      { status: 400 },
    );
  }

  try {
    const episodes = await getSeasonEpisodes(showId, season);
    return NextResponse.json({ episodes });
  } catch {
    return NextResponse.json(
      { error: "Failed to load episodes." },
      { status: 502 },
    );
  }
}
