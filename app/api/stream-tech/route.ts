import { NextRequest, NextResponse } from "next/server";
import { getStreamTech } from "@/lib/stream-tech";

export const maxDuration = 30;

const EMPTY = { height: null, video: null, audio: null };

// The browser used to run this probe itself: a resolve, a master playlist, a
// variant playlist and a 128 KB segment read, on every detail page view. It is
// one cached JSON response now.
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
    // Badges are decorative, so a failed probe is a 200 with nothing in it.
    // The short window keeps a broken title from re-probing on every view.
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "public, max-age=300" },
    });
  }
}
