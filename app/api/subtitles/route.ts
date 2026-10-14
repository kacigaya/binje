import { NextRequest, NextResponse } from "next/server";
import { parseResolveParams } from "@/lib/sources";
import { titleSubtitles } from "@/lib/subtitles";

export const maxDuration = 20;

// Accept the /api/resolve title query to find subtitles independent of the playing source.
export async function GET(request: NextRequest) {
  const params = parseResolveParams(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  try {
    // Disable browser caching so every call re-registers hosts in the proxy's in-memory allowlist.
    // Cache subtitle lists on the server instead; restarts empty the allowlist.
    return NextResponse.json({ tracks: await titleSubtitles(params) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Subtitles unavailable." }, { status: 502 });
  }
}
