import type { en } from './en';

export const fr: Record<keyof typeof en, string> = {
  home: 'Accueil', movies: 'Films', tvShows: 'Séries', watchlist: 'Ma liste', search: 'Rechercher', settings: 'Réglages',
  trending: 'Tendance', tvSeries: 'Série', related: 'Similaires', browse: 'Parcourir', library: 'Bibliothèque', popular: 'Populaires',
  trendingMovies: 'Films tendance', trendingTV: 'Séries tendance', popularMovies: 'Films populaires', popularTV: 'Séries populaires',
  topRated: 'Les mieux notés', nowPlaying: 'Actuellement au cinéma', upcoming: 'Prochainement', airingToday: 'Diffusées aujourd’hui', onTheAir: 'En cours de diffusion',
  continueWatching: 'Continuer à regarder', director: 'Réalisation', createdBy: 'Créé par', watchNow: 'Regarder', details: 'Détails', overview: 'Synopsis', cast: 'Distribution', seasons: 'Saisons', episodes: 'Épisodes',
  addToWatchlist: 'Ajouter à ma liste', removeFromWatchlist: 'Retirer de ma liste', myWatchlist: 'Ma liste', emptyWatchlist: 'Votre liste est vide',
  privacy: 'Confidentialité', privacyPolicy: 'Politique de confidentialité', consentTitle: 'Nous utilisons le stockage local', consentBody: 'Nous enregistrons votre historique sur cet appareil pour reprendre là où vous vous êtes arrêté. Aucun suivi.', accept: 'Accepter', dismiss: 'Fermer', allowStorage: 'Autoriser cookies et stockage local',
  errorTitle: 'Une erreur est survenue', errorBody: 'Impossible de charger le contenu. Le problème est peut-être temporaire. Veuillez réessayer.', retry: 'Réessayer', loading: 'Chargement…',
  back: 'Retour', quality: 'Qualité', auto: 'Auto',
  noResults: 'Aucun résultat', noPoster: 'Aucune affiche', searchPlaceholder: 'Rechercher des films et séries…', season: 'Saison', episode: 'Épisode', previous: 'Précédent', next: 'Suivant',
  streamUnavailable: 'Flux indisponible. Réessayez plus tard.', language: 'Langue', english: 'Anglais', french: 'Français', clearHistory: 'Effacer l’historique', removeHistory: 'Retirer de la liste Continuer à regarder',
};
