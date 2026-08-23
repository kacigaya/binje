# Instant navigation regression rig

## Goal

Keep the meaningful shell for `/en/watch/tv/1399?s=1&e=1` available on the initial document response while request-time route values and TMDB episode data are locked.

## Contract

- The shared navigation and footer are static page chrome.
- The watch route renders `watch-tv-shell` immediately.
- The fallback includes a localized `h1` named `TV` and the existing player skeleton marked `watch-tv-player-frame`.
- TMDB show information marked `watch-tv-data` and the request-time player region marked `watch-tv-player` must not appear inside the `instant()` lock.
- `params` and cached show details stay in a focused information boundary. `searchParams` and episode data stay in the request-time player boundary.
- Partial Prefetching keeps its default behavior. No destination is forced to use `prefetch={true}`.

## Production command

```bash
bun run test:instant
```

The command builds with `NEXT_INSTANT_TEST=1`, starts `next start` with the same gate on port 3100 through Playwright, and runs the Chromium regression. The testing API remains disabled in ordinary production builds.
