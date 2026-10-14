import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// Exclude /search (noindex) and /watch/* (canonical movie/TV URLs).
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
