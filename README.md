<p align="center">
  <img src="public/logo-dark.svg" alt="b!nje logo" width="140">
</p>

<h1 align="center">b!nje</h1>

<p align="center">A movie and TV discovery app for web, Android, and iOS.</p>

<p align="center">
  <a href="https://nextjs.org"><img alt="Next.js 16.3.2" src="https://shieldcn.dev/badge/Next.js-16.3.2-171717.svg?variant=secondary&amp;logo=nextdotjs"></a>
  <a href="https://bun.sh"><img alt="Bun 1.3" src="https://shieldcn.dev/badge/Bun-1.3-fbf0df.svg?variant=secondary&amp;logo=bun&amp;logoColor=171717"></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind CSS 4" src="https://shieldcn.dev/badge/Tailwind_CSS-4-06b6d4.svg?variant=secondary&amp;logo=tailwindcss"></a>
  <a href="https://expo.dev"><img alt="Expo 57" src="https://shieldcn.dev/badge/Expo-57-000020.svg?variant=secondary&amp;logo=expo"></a>
  <a href="https://github.com/kacigaya/binje/blob/main/LICENSE"><img alt="MIT License" src="https://shieldcn.dev/github/license/kacigaya/binje.svg?variant=secondary"></a>
</p>

## Features

- Browse, search, and filter movies and TV shows (data from TMDB).
- Watch in a custom HLS player with subtitles, quality select, and auto-sync.
- Cast with Google Cast and AirPlay.
- English and French interfaces.
- Expo mobile app for Android and iOS.

## Screenshots

### Desktop

![Home page with rotating hero and trending carousels](public/screenshots/home-desktop.jpg)

Home: auto-rotating hero with title logo, TMDB and Rotten Tomatoes scores, certification, and a pause control, followed by trending carousels.

![Movie detail page for Fight Club](public/screenshots/movie-desktop.jpg)

Movie detail: poster, title logo, TMDB and Rotten Tomatoes scores, certification, runtime, release date, watchlist button.

![TV show detail page for Breaking Bad](public/screenshots/tv-desktop.jpg)

TV detail: season and episode counts alongside the same ratings, certification, and first air date.

![Search results for the query dune](public/screenshots/search-desktop.jpg)

Search: fuzzy, year-aware results with All / Movies / TV Shows filters.

### Mobile web

| Home | Movie | TV | Search |
| --- | --- | --- | --- |
| <img src="public/screenshots/home-mobile.jpg" alt="Home page on a phone viewport" width="180"> | <img src="public/screenshots/movie-mobile.jpg" alt="Movie detail page on a phone viewport" width="180"> | <img src="public/screenshots/tv-mobile.jpg" alt="TV show detail page on a phone viewport" width="180"> | <img src="public/screenshots/search-mobile.jpg" alt="Search results on a phone viewport" width="180"> |

Posters, backdrops, and logos in these screenshots come from TMDB.

## Setup

1. Install [Bun](https://bun.sh).
2. Create `.env.local`:

   ```bash
   TMDB_API_KEY=your_key
   OMDB_API_KEY=your_key        # optional: Rotten Tomatoes scores
   STREAM_PROXY_URL=http://...  # optional: VPN proxy for Atlantic streams
   ```

3. Install and run:

   ```bash
   bun install
   bun dev
   ```

4. Open <http://localhost:3000>.

Subtitle auto-sync needs `ffmpeg` on the server. The Docker image includes it.

## Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
bun run mobile:start
```

See [`apps/mobile/README.md`](./apps/mobile/README.md).

## Privacy

Watch history stays in your browser's `localStorage`. No tracking and no analytics.

## License

MIT
