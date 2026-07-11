import { expect, test } from "bun:test";
import { normalizeForMatch } from "@/lib/tmdb";

test("normalizes French accents for search matching", () => {
  expect(normalizeForMatch("Amélie Poulain")).toBe("ameliepoulain");
  expect(normalizeForMatch("L'été dernier")).toBe("letedernier");
});
