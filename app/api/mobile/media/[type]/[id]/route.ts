import type { NextRequest } from "next/server";
import { parseId, parseLocale, parseMediaType } from "@/lib/api-validation";
import { serializeMovieDetails, serializeTVDetails } from "@/lib/mobile-api";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";
import { getMovieCredits, getMovieDetails, getMovieImages, getSimilarMovies, getTVCredits, getTVDetails, getTVImages, getSimilarTV, pickMovieLogo, pickTVLogo } from "@/lib/tmdb";
import { mobileError, mobileJson } from "../../../_utils";

export const mediaDependencies = { getMovieDetails, getMovieCredits, getMovieImages, getSimilarMovies, getTVDetails, getTVCredits, getTVImages, getSimilarTV, getRottenTomatoesScore };
export async function GET(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type: rawType, id: rawId } = await context.params;
    const type = parseMediaType(rawType), id = parseId(rawId), lang = parseLocale(request.nextUrl.searchParams.get("lang"));
    if (type === "movie") {
      const detailPromise = mediaDependencies.getMovieDetails(id, lang);
      const [detail, credits, related, score, images] = await Promise.all([detailPromise, mediaDependencies.getMovieCredits(id, lang), mediaDependencies.getSimilarMovies(id, lang), detailPromise.then((m) => mediaDependencies.getRottenTomatoesScore(m.imdb_id)), mediaDependencies.getMovieImages(id, lang).catch(() => null)]);
      return mobileJson(serializeMovieDetails(detail, credits, related, score, images ? pickMovieLogo(images.logos, lang) : null));
    }
    const detailPromise = mediaDependencies.getTVDetails(id, lang);
    const [detail, credits, related, score, images] = await Promise.all([detailPromise, mediaDependencies.getTVCredits(id, lang), mediaDependencies.getSimilarTV(id, lang), detailPromise.then((s) => mediaDependencies.getRottenTomatoesScore(s.external_ids?.imdb_id)), mediaDependencies.getTVImages(id, lang).catch(() => null)]);
    return mobileJson(serializeTVDetails(detail, credits, related, score, images ? pickTVLogo(images.logos, lang) : null));
  } catch (error) { return mobileError(error); }
}
