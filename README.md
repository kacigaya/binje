<p align="center">
  <img src="public/icon.svg" alt="Logo" width="200">
</p>

<h1 align="center">b!nje</h1>

<p align="center">
   <strong>A movie and TV discovery app for web, Android, and iOS.</strong><br>
   <em>Powered by TMDB API with optional Rotten Tomatoes scores via OMDb.</em>
</p>

## Features

- Browse trending and popular movies & TV shows
- English and French interfaces at `/en` and `/fr`, with localized TMDB metadata
- Dedicated `/movies` and `/tv-shows` browse pages
- Detailed movie and TV show pages (ratings, cast, seasons, similar, recommendations)
- Search with fuzzy matching, year-aware ranking, and live navbar suggestions
- Watch pages serving your own HLS library, with subtitles and manual quality selection
- TV episode scroller with edge fade and arrow controls, episode overlay preview cards
- "Continue Watching" row backed by local play history
- Hero with auto-rotating featured titles, two-line expandable overview, and TMDB/Rotten Tomatoes ratings
- Lazy-loaded carousels and loading skeletons
- Cookie consent banner that gates play-history writes, with a `/privacy` policy page
- Per-page SEO metadata via `generateMetadata`
- Image optimization (AVIF/WebP, TMDB-aligned responsive sizes, 30-day cache TTL)
- TMDB logos on watch pages
- Responsive dark theme (Tailwind v4, shadcn tokens, red accent)
- Expo SDK 57 mobile client with native navigation, local watchlist/history, and HLS playback

## Tech stack

- Framework: Next.js 16 (Turbopack, App Router)
- UI: React 19, Tailwind CSS 4, shadcn tokens, Lucide icons
- Styling: clsx, tailwind-merge
- Data: TMDB (movies/TV), OMDb (optional Rotten Tomatoes scores)
- Player: hls.js against your own S3-compatible library, proxied through `/api/hls`
- Language: TypeScript
- Testing: Bun test, Playwright
- Mobile: Expo Router, React Native, expo-video, TanStack Query, AsyncStorage

## Getting started

### Prerequisites

- Bun
- A TMDB API key (set in `.env.local`)
- An optional OMDb API key (`OMDB_API_KEY`) for Rotten Tomatoes scores

Without `OMDB_API_KEY`, detail pages continue showing TMDB ratings only. OMDb content is
licensed for non-commercial use; commercial deployments should use a licensed ratings
provider.

### Installation

```bash
bun install
```

### Development

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
Unprefixed URLs redirect to `/en` or `/fr` from the browser language; use the
navbar language switch to change locale while keeping the current page.

### Stream library

`/api/resolve` serves playback from an S3-compatible bucket you control (R2, S3, MinIO,
B2). Set these in `.env.local`:

```
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
STORAGE_BUCKET=binje
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_REGION=auto              # optional, defaults to "auto"
STORAGE_PREFIX=library           # optional, confines every key to this prefix
STORAGE_URL_TTL_SECONDS=900      # optional signed-URL lifetime
```

Without these, `/api/resolve` returns 503 and the player reports the title as
unplayable. Credentials stay server-side: the resolvers hand the browser signed
`/api/hls` URLs and the proxy signs each storage fetch, refusing anything that is not a
media file inside the configured bucket and prefix.

Each title carries an `index.json` manifest at `movies/<tmdbId>/` or
`tv/<tmdbId>/s<season>e<episode>/`:

```json
{
  "renditions": [
    { "height": 1080, "file": "movies/37165/1080p.m3u8" },
    { "height": 720, "file": "movies/37165/720p.m3u8" }
  ],
  "subtitles": [{ "label": "English", "file": "movies/37165/subs/en.vtt" }]
}
```

`file` is a bucket key, or an absolute `https://` URL to serve through a CDN in front of
the bucket. Playback defaults to 1080p when present, otherwise the highest rendition. A
missing manifest resolves as 404 and the player says the title cannot be played.

### Stream proxy

`/api/resolve` and `/api/resolve-vf` return stream URLs already wrapped in `/api/hls`
and signed with an HMAC that expires after six hours. `/api/hls` refuses any target it
did not mint, so the proxy cannot be used as an open relay for arbitrary hosts. The
signing key is read from the first of these that is set:

```
HLS_SIGNING_SECRET=...            # optional, otherwise falls back below
STORAGE_SECRET_ACCESS_KEY=...
TMDB_API_KEY=...
```

Set `HLS_SIGNING_SECRET` explicitly if you want to rotate proxy tokens without touching
storage or TMDB credentials. Rotating the key invalidates every signed URL already
handed out, so players re-resolve.

Unsigned requests are still accepted for objects inside your own bucket and prefix, so
mobile builds released before signing keep playing. Remove that branch in
`app/api/hls/route.ts` once those clients are gone.

### Mobile development

```bash
cp apps/mobile/.env.example apps/mobile/.env
bun run mobile:start
```

The Expo application uses the Next.js deployment as its backend. See
[`apps/mobile/README.md`](./apps/mobile/README.md) for development-build and EAS instructions.

### Project structure

```
app/            # Next.js App Router pages and layouts
  [locale]/     # English/French pages
  api/          # Server routes (search, stream resolution, HLS, episodes)
  movie/[id]/   # Movie detail page
  movies/       # Browse all movies
  search/       # Search results
  tv/[id]/      # TV show detail page
  tv-shows/     # Browse all TV shows
  watch/[id]/   # Movie watch page
  watch/tv/[id] # TV episode watch page
  privacy/      # Privacy policy
components/     # Reusable web UI components (Hero, Carousel, Player, etc.)
apps/mobile/    # Expo Router application for Android and iOS
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
