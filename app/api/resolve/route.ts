import { NextRequest, NextResponse } from "next/server";
import { allowStreamHosts } from "@/lib/hls-hosts";
import { cachedResolveVideasyStream } from "@/lib/resolve-cache";

export const maxDuration = 20;

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
    const result = await cachedResolveVideasyStream({
      type,
      id: id!,
      title,
      year,
      imdbId,
      season,
      episode,
    });
    allowStreamHosts([
      result.url,
      ...result.tracks.map((track) => track.file),
      ...(result.sources ?? []).map((source) => source.file),
    ]);
    // Private and short: the URLs are signed and single-viewer, but a reload or
    // a detail-page-to-watch-page hop should not pay for the chain twice.
    return NextResponse.json(result, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve stream." },
      { status: 502 },
    );
  }
}
