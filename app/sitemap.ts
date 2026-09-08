import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// Only indexable routes belong here: /search is noindex (see
// app/[locale]/search/layout.tsx) and /watch/* canonicalizes to its
// movie/tv page, so neither is listed.
const PATHS = ["", "/movies", "/tv-shows", "/watchlist", "/privacy", "/dmca"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.6,
    })),
  );
}
