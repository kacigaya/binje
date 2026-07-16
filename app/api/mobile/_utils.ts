import { NextResponse } from "next/server";
import { ApiValidationError } from "@/lib/api-validation";

export const MOBILE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "Netlify-Vary": "query",
};
export function mobileJson(data: unknown, status = 200, cache = status === 200) {
  return NextResponse.json(data, { status, headers: cache ? MOBILE_CACHE_HEADERS : { "Cache-Control": "no-store" } });
}
export function mobileError(error: unknown) {
  if (error instanceof ApiValidationError) return mobileJson({ error: { code: error.code, message: error.message } }, 400, false);
  const message = error instanceof Error ? error.message : "";
  if (/TMDB API error:\s*404/.test(message)) return mobileJson({ error: { code: "NOT_FOUND", message: "Media not found." } }, 404, false);
  console.error("Mobile API upstream request failed", error);
  return mobileJson({ error: { code: "UPSTREAM_ERROR", message: "Unable to load media." } }, 502, false);
}
