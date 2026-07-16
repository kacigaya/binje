import type { NextRequest } from "next/server";
import { parseId, parseLocale, parseSeason } from "@/lib/api-validation";
import { serializeEpisodes } from "@/lib/mobile-api";
import { getSeasonEpisodes } from "@/lib/tmdb";
import { mobileError, mobileJson } from "../../../_utils";

export const seasonDependencies = { getSeasonEpisodes };
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; season: string }> }) {
  try {
    const params = await context.params;
    const showId = parseId(params.id), seasonNumber = parseSeason(params.season), lang = parseLocale(request.nextUrl.searchParams.get("lang"));
    const episodes = await seasonDependencies.getSeasonEpisodes(showId, seasonNumber, lang);
    return mobileJson({ showId, seasonNumber, episodes: serializeEpisodes(episodes) });
  } catch (error) { return mobileError(error); }
}
