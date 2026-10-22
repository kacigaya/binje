import { NextRequest, NextResponse } from "next/server";
import { isPlaybackSource, parseResolveParams, resolvePlaybackSource } from "@/lib/sources";

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const source = query.get("source");
  const params = parseResolveParams(query);
  if (!isPlaybackSource(source) || !params) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  try {
    const result = await resolvePlaybackSource(source, params);
    // Cache privately and briefly: signed URLs are per viewer, but reloads should reuse the resolve.
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
