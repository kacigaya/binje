import { NextRequest, NextResponse } from "next/server";
import { parseResolveParams } from "@/lib/sources";
import { searchSubtitles, subtitleFile, subtitlesEnabled, WyzieBudgetError } from "@/lib/wyzie";

export const maxDuration = 20;

// Without `sub`: the title's subtitles as same-origin tracks. With `sub`: that
// file as WebVTT. Both take the /api/resolve title query; the file is looked up
// in the title's search so only listed files can be fetched.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const params = parseResolveParams(query);
  const sub = query.get("sub");
  if (!params || (sub !== null && !/^[\w-]{1,64}$/.test(sub))) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }
  if (!subtitlesEnabled()) {
    return sub === null
      ? NextResponse.json({ tracks: [] }, { headers: { "cache-control": "private, max-age=3600" } })
      : NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const subtitles = await searchSubtitles(params);
    if (sub === null) {
      const tracks = subtitles.map((subtitle) => {
        const fileQuery = new URLSearchParams(query);
        fileQuery.set("sub", subtitle.id);
        return {
          file: `/api/subtitles?${fileQuery}`,
          language: subtitle.language,
          hearingImpaired: subtitle.hearingImpaired,
        };
      });
      return NextResponse.json({ tracks }, { headers: { "cache-control": "private, max-age=3600" } });
    }

    const subtitle = subtitles.find((item) => item.id === sub);
    if (!subtitle) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(await subtitleFile(subtitle), {
      headers: {
        "content-type": "text/vtt; charset=utf-8",
        "cache-control": "public, max-age=86400",
        // Cast receivers load text tracks cross-origin.
        "access-control-allow-origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof WyzieBudgetError) {
      return NextResponse.json({ error: "Subtitles unavailable." }, { status: 503, headers: { "retry-after": "3600" } });
    }
    return NextResponse.json({ error: "Subtitles unavailable." }, { status: 502 });
  }
}
