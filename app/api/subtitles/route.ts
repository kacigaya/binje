import { NextRequest, NextResponse } from "next/server";
import { parseResolveParams } from "@/lib/sources";
import { titleSubtitles } from "@/lib/subtitles";

export const maxDuration = 20;

// Subtitles for a title from providers that publish them, for sources that
// ship none. Takes the /api/resolve title query.
export async function GET(request: NextRequest) {
  const params = parseResolveParams(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  try {
    // Not cached by browsers: each call re-registers the file hosts with the
    // in-memory /api/hls allowlist, which a restart empties. The server
    // caches the lists instead.
    return NextResponse.json({ tracks: await titleSubtitles(params) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Subtitles unavailable." }, { status: 502 });
  }
}
