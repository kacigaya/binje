import { NextRequest, NextResponse } from "next/server";
import { proxyResolverPayload } from "@/lib/hls-token";
import {
  manifestKey,
  parseLibraryManifest,
  toResolverResult,
} from "@/lib/library";
import {
  objectUrl,
  presignGet,
  resolveFileUrl,
  storageConfigFromEnv,
} from "@/lib/storage";

export const runtime = "nodejs";
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

  const config = storageConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { error: "Library storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const key = manifestKey({ type, id: id!, season, episode });
    const manifestUrl = await presignGet(config, objectUrl(config, key));
    const response = await fetch(manifestUrl, { cache: "no-store" });

    if (response.status === 403 || response.status === 404) {
      return NextResponse.json(
        { error: "Title not in library." },
        { status: 404 },
      );
    }
    if (!response.ok) throw new Error("Manifest fetch failed.");

    const manifest = parseLibraryManifest(await response.json());
    const result = toResolverResult(manifest, (file) =>
      resolveFileUrl(config, file),
    );

    return NextResponse.json(
      await proxyResolverPayload(request.nextUrl.origin, result),
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve stream." },
      { status: 502 },
    );
  }
}
