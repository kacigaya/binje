export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const FRENCH = {
  "Discover and stream thousands of movies. Your cinematic journey starts here.":
    "Découvrez et regardez des milliers de films. Votre voyage cinématographique commence ici.",
  Movies: "Films",
  "TV Shows": "Séries",
  Watchlist: "Ma liste",
  Search: "Rechercher",
  "Search movies & TV...": "Rechercher des films et séries...",
  "Search movies & TV shows...": "Rechercher des films et séries...",
  "Open menu": "Ouvrir le menu",
  "Close menu": "Fermer le menu",
  "Open search": "Ouvrir la recherche",
  "Close search": "Fermer la recherche",
  Untitled: "Sans titre",
  Movie: "Film",
  TV: "Série",
  "Trending Movies": "Films tendance",
  "Trending TV Shows": "Séries tendance",
  "Popular Movies": "Films populaires",
  "Top Rated Movies": "Films les mieux notés",
  "Now Playing": "Actuellement au cinéma",
  Upcoming: "Prochainement",
  Action: "Action",
  Comedy: "Comédie",
  Drama: "Drame",
  Horror: "Horreur",
  "Sci-Fi": "Science-fiction",
  "Popular TV Shows": "Séries populaires",
  "Top Rated TV Shows": "Séries les mieux notées",
  "Airing Today": "Diffusées aujourd’hui",
  "On The Air": "En cours de diffusion",
  "Action & Adventure": "Action et aventure",
  "Sci-Fi & Fantasy": "Science-fiction et fantastique",
  Documentary: "Documentaire",
  "Continue Watching": "Continuer à regarder",
  Trending: "Tendance",
  "TV Series": "Série",
  "Scroll left": "Faire défiler vers la gauche",
  "Scroll right": "Faire défiler vers la droite",
  "Watch Now": "Regarder",
  Details: "Détails",
  "Read more": "Lire la suite",
  "Show less": "Réduire",
  Director: "Réalisation",
  Overview: "Synopsis",
  "Created by": "Créée par",
  Network: "Chaîne",
  Cast: "Distribution",
  Seasons: "Saisons",
  "Similar Movies": "Films similaires",
  "Similar Shows": "Séries similaires",
  "Add to Watchlist": "Ajouter à ma liste",
  "In Watchlist": "Dans ma liste",
  "My Watchlist": "Ma liste",
  "Movies and TV shows you saved to watch later.":
    "Les films et séries que vous avez enregistrés pour plus tard.",
  "Your watchlist is empty": "Votre liste est vide",
  "Browse movies and TV shows, then tap":
    "Parcourez les films et séries, puis appuyez sur",
  "to save them here for later.": "pour les enregistrer ici.",
  "Privacy Policy": "Politique de confidentialité",
  "How b!nje handles your data: local watch history, no tracking, no third-party cookies.":
    "Comment b!nje gère vos données : historique local, aucun suivi et aucun cookie tiers.",
  "What we store": "Ce que nous stockons",
  "What we don't do": "Ce que nous ne faisons pas",
  "Third parties": "Services tiers",
  "Managing your data": "Gérer vos données",
  Contact: "Contact",
  Cookies: "Cookies",
  Privacy: "Confidentialité",
  "Cookie consent": "Consentement aux cookies",
  Dismiss: "Fermer",
  "We use local storage": "Nous utilisons le stockage local",
  "We store your watch history in your browser so you can pick up where you left off. No tracking, no third-party cookies.":
    "Nous enregistrons votre historique de visionnage dans votre navigateur pour reprendre là où vous vous êtes arrêté. Aucun suivi, aucun cookie tiers.",
  Accept: "Accepter",
  "Something went wrong": "Une erreur est survenue",
  "We couldn't load the content. This might be temporary. Please try again.":
    "Impossible de charger le contenu. Le problème est peut-être temporaire. Veuillez réessayer.",
  "Try Again": "Réessayer",
  All: "Tout",
  "No results found": "Aucun résultat",
  "No Poster": "Aucune affiche",
  "Try a different search term or check the spelling.":
    "Essayez une autre recherche ou vérifiez l’orthographe.",
  "Discover movies & TV shows": "Découvrez des films et séries",
  "Start typing to search thousands of titles.":
    "Commencez à écrire pour rechercher parmi des milliers de titres.",
  "No VF stream for this title.": "Aucun flux VF disponible pour ce titre.",
  "Stream unavailable. Try again later.":
    "Flux indisponible. Réessayez plus tard.",
  "Loading…": "Chargement…",
  Season: "Saison",
  Episode: "Épisode",
  "Now playing": "Lecture en cours",
  Previous: "Précédent",
  Next: "Suivant",
  Episodes: "Épisodes",
  "No episode previews available.": "Aucun aperçu d’épisode disponible.",
  "No preview": "Aucun aperçu",
  Watching: "En lecture",
  "Remove from watchlist": "Retirer de ma liste",
  "Remove from continue watching": "Retirer de la liste Continuer à regarder",
  "N/A": "N/D",
} as const;

export type TranslationKey = keyof typeof FRENCH;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, text: TranslationKey): string {
  return locale === "fr" ? FRENCH[text] : text;
}

export function localizedHref(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  return `/${locale}${href === "/" ? "" : href}`;
}

export function preferredLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const languages = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters.find((value) => value.trim().startsWith("q="));
      return { tag, quality: quality ? Number(quality.trim().slice(2)) : 1 };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of languages) {
    const locale = tag.split("-")[0];
    if (isLocale(locale)) return locale;
  }
  return DEFAULT_LOCALE;
}
