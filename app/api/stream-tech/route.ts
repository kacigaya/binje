import { NextRequest, NextResponse } from "next/server";
import { getStreamTech } from "@/lib/stream-tech";

export const runtime = "nodejs";
const EMPTY = { height: null, video: null, audio: null };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = query.get("type");
  const id = query.get("id") ?? "";
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id) || !title || title.length > 200 || !/^\d{4}$/.test(year) || (imdbId && !/^tt\d+$/.test(imdbId)) || (type === "tv" && (!/^[1-9]\d*$/.test(season) || !/^[1-9]\d*$/.test(episode)))) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  try {
    const info = await getStreamTech({ type, id, title, year, imdbId, season, episode });
    return NextResponse.json(info, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}
