import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

const PATHS = ["", "/movies", "/tv-shows", "/search", "/watchlist", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.6,
    })),
  );
}
