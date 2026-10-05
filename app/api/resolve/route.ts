import { NextRequest, NextResponse } from "next/server";
import { isPlaybackSource, parseResolveParams, resolvePlaybackSource } from "@/lib/sources";

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  // Videasy was the only provider when this route had no source parameter.
  const source = query.get("source") ?? "videasy";
  const params = parseResolveParams(query);
  if (!isPlaybackSource(source) || !params) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const result = await resolvePlaybackSource(source, params);
    // Private and short: the URLs are signed and single-viewer, but a reload or
    // a detail-page-to-watch-page hop should not pay for the chain twice.
    return NextResponse.json({ url: result.url, tracks: result.tracks, sources: result.sources }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve stream." },
      { status: 502 },
    );
  }
}
