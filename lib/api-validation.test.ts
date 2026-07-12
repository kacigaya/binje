import { describe, expect, test } from "bun:test";
import { ApiValidationError, parseBrowseQuery, parseId, parseLocale, parseSeason } from "./api-validation";

const message = (fn: () => unknown) => { try { fn(); } catch (error) { return (error as Error).message; } };
describe("mobile API validation", () => {
  test("accepts supported defaults", () => { expect(parseLocale(null)).toBe("en"); expect(parseBrowseQuery(new URLSearchParams("type=movie&category=popular"))).toEqual({ type: "movie", category: "popular", page: 1, lang: "en" }); });
  test("rejects invalid locale", () => expect(message(() => parseLocale("de"))).toBe("Invalid locale."));
  test("rejects invalid media type", () => expect(message(() => parseBrowseQuery(new URLSearchParams("type=person&category=popular")))).toBe("Invalid media type."));
  test("rejects category incompatible with type", () => expect(message(() => parseBrowseQuery(new URLSearchParams("type=tv&category=now-playing")))).toBe("Invalid category."));
  test("rejects invalid ID", () => expect(message(() => parseId("1x"))).toBe("Invalid ID."));
  test("rejects invalid page", () => expect(message(() => parseBrowseQuery(new URLSearchParams("type=movie&category=popular&page=0")))).toBe("Invalid page."));
  test("rejects invalid season", () => expect(message(() => parseSeason("-1"))).toBe("Invalid season."));
  test("errors have stable code", () => expect(() => parseId("bad")).toThrow(ApiValidationError));
});
