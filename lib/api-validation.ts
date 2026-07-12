import type { MobileLocale, MobileMediaType } from "@/types/mobile-api";

export type MovieCategory = "trending" | "popular" | "top-rated" | "now-playing" | "upcoming";
export type TVCategory = "trending" | "popular" | "top-rated" | "airing-today" | "on-the-air";
export type BrowseCategory = MovieCategory | TVCategory;

export class ApiValidationError extends Error {
  readonly code = "INVALID_REQUEST" as const;
  constructor(message: string) { super(message); this.name = "ApiValidationError"; }
}
const integer = (value: string, label: string, allowZero = false) => {
  if (!/^\d+$/.test(value)) throw new ApiValidationError(`Invalid ${label}.`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1)) throw new ApiValidationError(`Invalid ${label}.`);
  return result;
};
export function parseLocale(value: string | null): MobileLocale {
  if (value === null || value === "") return "en";
  if (value !== "en" && value !== "fr") throw new ApiValidationError("Invalid locale.");
  return value;
}
export function parseMediaType(value: string): MobileMediaType {
  if (value !== "movie" && value !== "tv") throw new ApiValidationError("Invalid media type.");
  return value;
}
export const parseId = (value: string) => integer(value, "ID");
export const parseSeason = (value: string) => integer(value, "season", true);
export const parsePage = (value: string | null) => value === null || value === "" ? 1 : integer(value, "page");

const MOVIE = new Set<MovieCategory>(["trending", "popular", "top-rated", "now-playing", "upcoming"]);
const TV = new Set<TVCategory>(["trending", "popular", "top-rated", "airing-today", "on-the-air"]);
export function parseBrowseQuery(params: URLSearchParams): { type: MobileMediaType; category: BrowseCategory; page: number; lang: MobileLocale } {
  const type = parseMediaType(params.get("type") ?? "");
  const category = params.get("category") ?? "";
  if (!(type === "movie" ? MOVIE : TV).has(category as never)) throw new ApiValidationError("Invalid category.");
  return { type, category: category as BrowseCategory, page: parsePage(params.get("page")), lang: parseLocale(params.get("lang")) };
}
