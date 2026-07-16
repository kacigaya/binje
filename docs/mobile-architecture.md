# Mobile architecture

## Layout

- `app/`: existing Next.js web application and backend routes
- `app/api/mobile/`: compact mobile discovery/detail API facade
- `apps/mobile/`: Expo Router application
- `types/mobile-api.ts`: stable camelCase DTO contract

## Data flow

1. Expo screens call the typed client in `apps/mobile/src/api`.
2. The client targets `EXPO_PUBLIC_API_BASE_URL`.
3. Next.js mobile routes validate parameters and call server-only TMDB/OMDb integrations.
4. Routes serialize upstream data into stable mobile DTOs.
5. TanStack Query handles caching, retries, cancellation, and loading state.

## Playback

The Expo app asks `/api/resolve` or `/api/resolve-vf` for a stream and plays the proxied HLS URL with `expo-video`. Provider extraction and browser-like request headers remain on the server. Playback progress is throttled and stored locally after consent.

## Local state

AsyncStorage repositories validate every decoded record. Watchlist is limited to 100 unique titles and history to 20. TV progress is keyed by title, season, and episode. Locale selection prefers a saved choice, then the device locale, then English.

## Trust boundary

The mobile bundle contains no TMDB or OMDb key. `EXPO_PUBLIC_*` configuration is treated as public. Resolver failures return structured errors without exposing upstream details.
