# b!nje mobile

Expo SDK 57 client for Android and iOS. The mobile application uses the existing b!nje Next.js deployment as its API and stream-resolution backend, so TMDB and OMDb credentials remain server-side.

## Setup

```bash
cp apps/mobile/.env.example apps/mobile/.env
bun install
bun run mobile:start
```

`EXPO_PUBLIC_API_BASE_URL` must be the public origin of the b!nje Next.js backend, without a trailing slash.

## Development builds

The native player is tested through an Expo development build rather than Expo Go:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
```

EAS authentication and access to the owning Expo account are required. Store submission is not performed automatically.

For test builds with the JavaScript bundle included:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

The iOS preview profile needs Apple signing credentials and registered devices.
To build for the iOS Simulator without signing credentials:

```bash
npx eas-cli@latest build --platform ios --profile simulator
```

Simulator builds run in the iOS Simulator on macOS. They cannot install on an iPhone.

Google Cast uses the native sender SDK and Google's Default Media Receiver. After
adding or upgrading `react-native-google-cast`, rebuild the development client before
testing. The Cast button appears in the player when a compatible receiver is available
on the same network.

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

## Native UI

The app uses native tabs and navigation headers. Expo UI provides SwiftUI controls
on iOS and Compose controls on Android. Rebuild the development client after this
change. An older binary does not contain the Expo UI native module.

The app follows the system appearance and uses system fonts. Catalog columns
adapt to window width and text size. Native pickers include platform labels for
VoiceOver and TalkBack. React Native views display media artwork and text.
The consent sheet uses `RNHostView` to host its React Native scroll content.

Consent-sheet dismissal keeps storage disabled. Failed writes keep the screen
open and show an error. Watchlist actions show success only after a saved write.
Turning storage off preserves existing entries and blocks future list/history writes.
Language preference is saved separately.

Playback restores the matching episode position. Titles at 95 percent completion
restart from the beginning. Native source replacements run in order. A failed
quality change restores the previous source and selection.

Home shows the first featured title. Automatic hero rotation was removed so that
content stays stable while the user reads or uses a screen reader.

### Device verification

Automated tests check storage, cached-content recovery, save failures, and source
replacement ordering. Bundle exports do not prove native rendering or gestures.
Before release, test a rebuilt iOS and Android client with large text, screen readers,
light/dark appearance, back gestures, consent dismissal, fullscreen video, Picture
in Picture, and Cast. Check tablet split view and narrow phone layouts.
