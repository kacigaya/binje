# b!nje mobile

Expo SDK 57 client for Android and iOS. The mobile application uses the existing b!nje Next.js deployment as its API and stream-resolution backend, so TMDB and OMDb credentials remain server-side.

## Setup

```bash
cp apps/mobile/.env.example apps/mobile/.env
bun install
bun run mobile:start
```

`EXPO_PUBLIC_API_BASE_URL` must be the public origin of the b!nje Next.js backend, without a trailing slash.
Set optional `EXPO_PUBLIC_RESOLVE_BASE_URL` to the deployed resolver Worker origin when production stream extraction uses Cloudflare egress.

## Development builds

The native player is tested through an Expo development build rather than Expo Go:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
```

EAS authentication and access to the owning Expo account are required. Store submission is not performed automatically.

## Validation

```bash
bun run mobile:test -- --runInBand
bun run mobile:typecheck
bun run mobile:lint
cd apps/mobile
npx expo-doctor@latest
npx expo export --platform all --output-dir dist
```

## Local data

Language preference, consent, watchlist, and playback history are stored on the device with AsyncStorage. No account or cloud synchronization is implemented.

## Security boundary

Only `EXPO_PUBLIC_API_BASE_URL` is public. Never add TMDB, OMDb, resolver, or provider credentials to an `EXPO_PUBLIC_*` variable because Expo embeds these values in the application bundle.
