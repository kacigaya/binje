import { NextRequest, NextResponse } from "next/server";
import { allowStreamCookie, allowStreamHost, allowStreamHosts } from "@/lib/hls-hosts";
import { resolveMovieboxStream } from "@/lib/moviebox";
import { cachedResolveVideasyStream, type ResolveParams } from "@/lib/resolve-cache";
import type { ResolverResult } from "@/lib/videasy";
import { resolveVidzeeStream } from "@/lib/vidzee";

export const maxDuration = 20;

// Upstream headers a resolver hands back stay on the server: the proxy
// attaches them, the JSON response never carries them.
type Resolved = ResolverResult & { referer?: string; cookie?: string; cookieScope?: string };
const RESOLVERS: Record<string, (params: ResolveParams) => Promise<Resolved>> = {
  videasy: cachedResolveVideasyStream,
  vidzee: resolveVidzeeStream,
  moviebox: resolveMovieboxStream,
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = query.get("type");
  const source = query.get("source") ?? "videasy";
  const id = query.get("id");
  const title = query.get("title")?.trim() ?? "";
  const year = query.get("year") ?? "";
  const imdbId = query.get("imdbId")?.trim() ?? "";
  const season = query.get("season") ?? "1";
  const episode = query.get("episode") ?? "1";
  const validEpisode =
    type !== "tv" || (/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode));

  if (
    !Object.hasOwn(RESOLVERS, source) ||
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
    const result = await RESOLVERS[source]({ type, id: id!, title, year, imdbId, season, episode });
    if (result.referer) allowStreamHost(result.url, result.referer);
    if (result.cookie && result.cookieScope) allowStreamCookie(result.cookieScope, result.cookie);
    allowStreamHosts([
      result.url,
      ...result.tracks.map((track) => track.file),
      ...(result.sources ?? []).map((source) => source.file),
    ]);
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
