import { describe, expect, test } from "bun:test";
import {
  formatRating,
  localizedHref,
  pluralize,
  preferredLocale,
  translate,
} from "@/lib/i18n";

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

  test("formats ratings and plurals for the active locale", () => {
    expect(formatRating("en", 7.25)).toBe("7.3");
    expect(formatRating("fr", 7.25)).toBe("7,3");
    expect(formatRating("fr", Number.NaN)).toBeNull();
    expect(pluralize("en", 1, "Season", "Seasons")).toBe("Season");
    expect(pluralize("fr", 2, "Season", "Seasons")).toBe("Saisons");
  });

  // An unknown key falls through to the English identity, so a missing French
  // entry looks like working English rather than an error.
  test("translates consent and DMCA copy to French", () => {
    expect(translate("fr", "Refuse")).toBe("Refuser");
    expect(translate("fr", "DMCA Policy")).toBe("Politique DMCA");
    expect(translate("fr", "DMCA page")).toBe("page DMCA");
    expect(
      translate("fr", "b!nje hosts no files on its servers. All content is provided by unaffiliated third parties. For any claim, see our"),
    ).toContain("n’héberge aucun fichier");
    expect(translate("en", "DMCA Policy")).toBe("DMCA Policy");
  });
});
