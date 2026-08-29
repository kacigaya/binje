import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

/**
 * https://llmstxt.org — a Markdown map of the site for agents and crawlers.
 * Generated rather than shipped as a static file so it cannot drift from the
 * locales and canonical origin the sitemap and metadata already use.
 */
const SECTIONS: { path: string; name: string; description: string }[] = [
  { path: "", name: "Home", description: "Trending movies and TV shows." },
  { path: "/movies", name: "Movies", description: "Browse and discover movies." },
  { path: "/tv-shows", name: "TV Shows", description: "Browse and discover TV series." },
  { path: "/search", name: "Search", description: "Search the catalogue by title." },
  { path: "/watchlist", name: "Watchlist", description: "Titles saved in this browser." },
  { path: "/privacy", name: "Privacy", description: "What is stored locally and why." },
  { path: "/dmca", name: "DMCA", description: "Takedown policy and contact." },
];

function link(locale: string, path: string, name: string, description: string) {
  return `- [${name}](${SITE_URL}/${locale}${path}): ${description}`;
}

export function GET() {
  const body = [
    "# b!nje",
    "",
    "> A movie and TV discovery app. Catalogue data comes from TMDB, with optional Rotten Tomatoes scores via OMDb.",
    "",
    `Content is served per locale under \`/${LOCALES.join("/`, `/")}/\`. Watchlist and playback history live in the visitor's browser only; there is no account system and no server-side user data.`,
    "",
    "## Pages",
    "",
    ...SECTIONS.map((s) => link(DEFAULT_LOCALE, s.path, s.name, s.description)),
    "",
    "## Optional",
    "",
    ...LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) =>
      link(locale, "", `Home (${locale})`, `The ${locale} translation of the site.`),
    ),
    `- [Sitemap](${SITE_URL}/sitemap.xml): Every indexable URL.`,
    `- [Source](https://github.com/kacigaya/binje): The application source, MIT licensed.`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
