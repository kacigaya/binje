import { NextRequest, NextResponse } from "next/server";
import { resolvePlaybackSource } from "@/lib/sources";

export const maxDuration = 20;

// Kept for mobile builds that predate /api/resolve?source=vf.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = q.get("type");
  const id = q.get("id");
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id ?? "")) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  const season = q.get("season") ?? "1";
  const episode = q.get("episode") ?? "1";
  if (type === "tv" && !(/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode))) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    // Frembed is keyed by TMDB id alone; title and year are not consulted.
    const result = await resolvePlaybackSource("vf", { type, id: id!, title: "", year: "", imdbId: "", season, episode });
    return NextResponse.json({ url: result.url, tracks: result.tracks }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve VF stream." },
      { status: 502 },
    );
  }
}
