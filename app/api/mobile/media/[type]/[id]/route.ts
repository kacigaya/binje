import type { NextRequest } from "next/server";
import { parseId, parseLocale, parseMediaType } from "@/lib/api-validation";
import { serializeMovieDetails, serializeTVDetails } from "@/lib/mobile-api";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";
import { getMovieCredits, getMovieDetails, getSimilarMovies, getTVCredits, getTVDetails, getSimilarTV } from "@/lib/tmdb";
import { mobileError, mobileJson } from "../../../_utils";

export const mediaDependencies = { getMovieDetails, getMovieCredits, getSimilarMovies, getTVDetails, getTVCredits, getSimilarTV, getRottenTomatoesScore };
export async function GET(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type: rawType, id: rawId } = await context.params;
    const type = parseMediaType(rawType), id = parseId(rawId), lang = parseLocale(request.nextUrl.searchParams.get("lang"));
    if (type === "movie") {
      const detailPromise = mediaDependencies.getMovieDetails(id, lang);
      const [detail, credits, related, score] = await Promise.all([detailPromise, mediaDependencies.getMovieCredits(id, lang), mediaDependencies.getSimilarMovies(id, lang), detailPromise.then((m) => mediaDependencies.getRottenTomatoesScore(m.imdb_id))]);
      return mobileJson(serializeMovieDetails(detail, credits, related, score));
    }
    const detailPromise = mediaDependencies.getTVDetails(id, lang);
    const [detail, credits, related, score] = await Promise.all([detailPromise, mediaDependencies.getTVCredits(id, lang), mediaDependencies.getSimilarTV(id, lang), detailPromise.then((s) => mediaDependencies.getRottenTomatoesScore(s.external_ids?.imdb_id))]);
    return mobileJson(serializeTVDetails(detail, credits, related, score));
  } catch (error) { return mobileError(error); }
}
