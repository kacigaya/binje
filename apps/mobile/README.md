# b!nje mobile

Expo SDK 57 client for Android, Android TV, and iOS. The mobile application uses the existing b!nje Next.js deployment as its API and stream-resolution backend, so TMDB and OMDb credentials remain server-side.

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

The player draws subtitles itself, because `expo-video` cannot load external subtitle
files. The server proxy converts SRT files to WebVTT. The subtitle button selects a
track or turns subtitles off. The stream's own tracks start on. Title-wide tracks from
`/api/subtitles` start off. The mobile player does not have the web delay and
auto-sync controls.

On launch, the app asks `/api/mobile/version` for the latest GitHub release. The server
reads GitHub, so the app contacts only the b!nje service. When the release is newer than
the installed `app.json` version, a prompt opens the APK on Android and the release page
on iOS. **Later** hides the prompt until the next release. The prompt waits while the
consent sheet is open.

## Android TV

The app uses `react-native-tvos`, the React Native fork that supports phone and TV targets. Phone builds stay the same. The `@react-native-tvos/config-tv` plugin changes the Android project for TV only when `EXPO_TV=1` is set.

On TV, the app uses separate screens for Home, Search, and Details. A menu rail on the left replaces the tab bar. The route files select the TV screen when `Platform.isTV` is true.

To build an Android TV APK:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview_tv
```

Use `development_tv` for a development build. To generate the native project locally:

```bash
EXPO_TV=1 npx expo prebuild --platform android --clean
```

The TV build adds the Leanback launcher entry and the `assets/images/tv-banner.png` banner (320×180). It does not need a touchscreen. The remote moves focus between controls. Google Cast is not available on TV.

## Appearance and retained fixes

The app uses its original dark theme, Space Grotesk and Outfit fonts, artwork
layouts, custom tabs, buttons, and selectors. Expo UI controls are removed.
Rebuild native clients after this dependency change. Earlier download links
still contain the native UI redesign.

The rollback keeps storage error handling, playback resume, ordered source
changes, quality recovery, locale loading, and the security and EAS build fixes.
The player can enter landscape fullscreen. Other screens stay in portrait.

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
