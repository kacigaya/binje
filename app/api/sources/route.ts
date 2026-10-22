import { NextRequest, NextResponse } from "next/server";
import { availablePlaybackSources, parseResolveParams } from "@/lib/sources";

// Sources that do not answer within lib/sources' probe deadline are left out.
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const query = new URLSearchParams(request.nextUrl.searchParams);
  const audio = query.get("audio") ?? "vo";
  query.delete("audio");
  const params = parseResolveParams(query);
  if (!params || (audio !== "vo" && audio !== "vf")) return NextResponse.json({ error: "Invalid params." }, { status: 400 });

  const sources = await availablePlaybackSources(params, audio);
  return NextResponse.json({ sources }, {
    headers: { "cache-control": "private, max-age=120" },
  });
}
