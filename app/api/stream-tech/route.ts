import { NextRequest, NextResponse } from "next/server";
import { getStreamTech } from "@/lib/stream-tech";

export const maxDuration = 30;

const EMPTY = { height: null, video: null, audio: null };

// Server-side so a detail page view costs one cached JSON response, not a probe.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = query.get("type");
  const id = query.get("id");
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  const validEpisode =
    type !== "tv" || (/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode));

  if (
    (type !== "movie" && type !== "tv") ||
    !/^\d+$/.test(id ?? "") ||
    !title ||
    title.length > 200 ||
    !/^\d{4}$/.test(year) ||
    (imdbId !== "" && !/^tt\d+$/.test(imdbId)) ||
    !validEpisode
  ) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const tech = await getStreamTech({ type, id: id!, title, year, imdbId, season, episode });
    return NextResponse.json(tech, {
      headers: { "cache-control": "public, max-age=21600" },
    });
  } catch {
    // Optional badges return empty 200 responses on failure; cache briefly to avoid repeated failed probes.
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "public, max-age=300" },
    });
  }
}
