<p align="center">
  <img src="public/icon.svg" alt="Logo" width="200">
</p>

<h1 align="center">b!nje</h1>

<p align="center">
   <strong>A modern movie and TV show discovery web application built with Next.js.</strong><br>
   <em>Powered by TMDB API.</em>
</p>

## Features

- Browse trending and popular movies, TV shows & anime
- Dedicated `/movies`, `/tv-shows` and `/anime` browse pages
- Detailed movie, TV and anime pages (cast, seasons, episodes, similar, recommendations)
- Anime powered by MyAnimeList (via the Jikan API) with sub/dub selection
- Search with fuzzy matching, year-aware ranking, and live navbar suggestions
- Watch pages for movies, TV episodes and anime with embedded player (vidlink.pro)
- TV episode scroller with edge fade and arrow controls, episode overlay preview cards
- "Continue Watching" row backed by local play history
- Hero with auto-rotating featured titles and expandable overview
- Lazy-loaded carousels and loading skeletons
- Cookie consent banner that gates play-history writes, with a `/privacy` policy page
- Per-page SEO metadata via `generateMetadata`
- Image optimization (AVIF/WebP, TMDB-aligned responsive sizes, 30-day cache TTL)
- TMDB logos on watch pages
- Responsive dark theme (Tailwind v4, shadcn tokens, red accent)

## Tech Stack

- **Framework:** Next.js 16 (Turbopack, App Router)
- **UI:** React 19, Tailwind CSS 4, Base UI primitives, shadcn/ui, Lucide icons
- **Styling:** class-variance-authority, clsx, tailwind-merge
- **Data:** TMDB (movies/TV), MyAnimeList via Jikan (anime)
- **Player:** vidlink.pro embedded player (movie / tv / anime)
- **Language:** TypeScript
- **Testing:** Playwright

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A TMDB API key (set in `.env.local`)

### Installation

```bash
bun install
# or
npm install
```

### Development

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Project Structure

```
app/            # Next.js App Router pages and layouts
  api/          # Server routes (search, episodes)
  movie/[id]/   # Movie detail page
  movies/       # Browse all movies
  anime/[id]/   # Anime detail page (MyAnimeList)
  anime/        # Browse all anime
  search/       # Search results
  tv/[id]/      # TV show detail page
  tv-shows/     # Browse all TV shows
  watch/[id]/   # Movie watch page
  watch/tv/[id] # TV episode watch page
  privacy/      # Privacy policy
components/     # Reusable UI components (Hero, Carousel, Player, etc.)
lib/            # Utilities and TMDB API client
types/          # TypeScript type definitions
public/         # Static assets
tests/          # Playwright tests
```

## Privacy

b!nje uses your browser's `localStorage` to remember your watch history. No tracking, no
analytics, no third-party cookies. You can re-open the consent banner at any time from
the "Cookies" link in the footer. See [`/privacy`](./app/privacy/page.tsx) for details.

## License

MIT
