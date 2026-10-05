import { NextRequest, NextResponse } from "next/server";
import { availablePlaybackSources, parseResolveParams } from "@/lib/sources";

// Sources that do not answer within lib/sources' probe deadline are left out.
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const params = parseResolveParams(request.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: "Invalid params." }, { status: 400 });

  const sources = await availablePlaybackSources(params);
  return NextResponse.json({ sources }, {
    headers: { "cache-control": "private, max-age=120" },
  });
}
