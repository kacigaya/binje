<p align="center">
  <img src="public/icon.svg" alt="Logo" width="200">
</p>

<h1 align="center">b!nje</h1>

<p align="center">
   <strong>A movie and TV discovery app built with Next.js.</strong><br>
   <em>Powered by TMDB API.</em>
</p>

## Features

- Browse trending and popular movies & TV shows
- Dedicated `/movies` and `/tv-shows` browse pages
- Detailed movie and TV show pages (cast, seasons, similar, recommendations)
- Search with fuzzy matching, year-aware ranking, and live navbar suggestions
- Watch pages for movies and TV episodes with embedded player (vidlink.pro)
- TV episode scroller with edge fade and arrow controls, episode overlay preview cards
- "Continue Watching" row backed by local play history
- Hero with auto-rotating featured titles and expandable overview
- Lazy-loaded carousels and loading skeletons
- Cookie consent banner that gates play-history writes, with a `/privacy` policy page
- Per-page SEO metadata via `generateMetadata`
- Image optimization (AVIF/WebP, TMDB-aligned responsive sizes, 30-day cache TTL)
- TMDB logos on watch pages
- Responsive dark theme (Tailwind v4, shadcn tokens, red accent)

## Tech stack

- Framework: Next.js 16 (Turbopack, App Router)
- UI: React 19, Tailwind CSS 4, Base UI primitives, shadcn/ui, Lucide icons
- Styling: class-variance-authority, clsx, tailwind-merge
- Data: TMDB (movies/TV)
- Player: vidlink.pro embedded player (movie / tv)
- Language: TypeScript
- Testing: Playwright

## Getting started

### Prerequisites

- Node.js 20+ and pnpm
- A TMDB API key (set in `.env.local`)

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Project structure

```
app/            # Next.js App Router pages and layouts
  api/          # Server routes (search, episodes)
  movie/[id]/   # Movie detail page
  movies/       # Browse all movies
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
