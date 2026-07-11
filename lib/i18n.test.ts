import { describe, expect, test } from "bun:test";
import { localizedHref, preferredLocale } from "@/lib/i18n";

describe("i18n", () => {
  test("selects supported language by quality", () => {
    expect(preferredLocale("en;q=0.7, fr-FR;q=0.9")).toBe("fr");
    expect(preferredLocale("de, en-US;q=0.8")).toBe("en");
    expect(preferredLocale(null)).toBe("en");
  });

  test("prefixes internal paths only", () => {
    expect(localizedHref("fr", "/movie/12?play=1")).toBe("/fr/movie/12?play=1");
    expect(localizedHref("en", "/")).toBe("/en");
    expect(localizedHref("fr", "https://example.com")).toBe("https://example.com");
  });
});
