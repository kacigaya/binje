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

The Expo app asks `/api/sources` which providers play the title, then `/api/resolve?source=<id>` for a stream, and plays the proxied HLS URL with `expo-video`. A source that fails to resolve or play is dropped and the next one starts. `/api/resolve-vf` remains for older builds. Provider extraction and browser-like request headers remain on the server. Playback progress is throttled and stored locally after consent.

For Google Cast, the native sender requests a short-lived token from `/api/cast`,
loads the token-bound HLS proxy URL in Google's Default Media Receiver, and transfers
the current position and subtitle tracks. Remote progress continues updating local
history. Disconnecting restores local playback at the last remote position.

`POST /api/cast` requires `Content-Type: application/json` and a body with
`url` for the stream and `subtitles` for subtitle URLs. The server checks every
host against the stream allowlist and private-network rules. Tokens last five
minutes. The sender renews them every four minutes by loading the same media
at the current position with the current pause state and subtitle selection.
The sender must remain active to renew. A suspended sender can let the token
expire. Older native builds must be updated to use the new request body.

## Local state

AsyncStorage repositories validate every decoded record. Watchlist is limited to 100 unique titles and history to 20. TV progress is keyed by title, season, and episode. Locale selection prefers a saved choice, then the device locale, then English.

## Trust boundary

The mobile bundle contains no TMDB or OMDb key. `EXPO_PUBLIC_*` configuration is treated as public. Resolver failures return structured errors without exposing upstream details.
