# Mobile release checklist

- [ ] Confirm Expo account and EAS project ownership
- [ ] Confirm `com.gayakaci.binje` for Android and iOS
- [ ] Confirm content rights and required store disclosures
- [ ] Confirm TMDB/OMDb/provider attribution
- [ ] Run root and mobile tests
- [ ] Run root and mobile lint
- [ ] Run mobile TypeScript checks
- [ ] Run Expo Doctor
- [ ] Export Android, iOS, and web bundles
- [ ] Install an Android development build and verify navigation
- [ ] Install an iOS development build and verify navigation
- [ ] Verify playback on both platforms
- [ ] Verify Google Cast discovery, playback transfer, subtitles, progress, and disconnect resume on Android and iOS
- [ ] Verify TV season and episode selection
- [ ] Verify consent, watchlist, history, and clear-data behavior
- [ ] Verify English and French layouts
- [ ] Verify Android back navigation and iOS gestures
- [ ] Install a `preview_tv` build on an Android TV device or emulator. Verify that the launcher banner shows, D-pad focus is visible on all screens, and the remote controls playback
- [ ] On TV, press Left at the screen edge and verify that the menu opens. Press Back on a main page and verify that focus moves to the menu
- [ ] On TV Home, press Right on the last hero button and verify that the next featured title shows. Move into a row and verify that the backdrop follows the focused card. Hold OK on a poster and verify that playback starts
- [ ] On TV Search, type with the on-screen keyboard. Hold OK on `e` and verify that the accent row opens. Hold Delete and verify that the query clears
- [ ] Verify no secrets exist in public Expo config or exported bundles
- [ ] Build internal preview binaries
- [ ] Obtain explicit approval before store submission

## Publish a release

1. Set `expo.version` in `apps/mobile/app.json` and `version` in `package.json` to the new version.
2. Merge the change to `main`.
3. Publish a GitHub release with tag `vX.Y.Z` that matches `expo.version`.
4. The `Release apps` workflow builds the Android phone APK and the Android TV APK (`EXPO_TV=1`) with Gradle on an Ubuntu runner. It does not use EAS, because the free EAS plan has a monthly Android build limit.
5. The same workflow builds an unsigned iOS IPA on a macOS runner.
6. The workflow attaches `binje-vX.Y.Z.apk`, `binje-vX.Y.Z-tv.apk`, `binje-vX.Y.Z.ipa`, and their SHA-256 files to the release.

The Android jobs sign each APK with the EAS upload key, so the APK updates earlier installs. The workflow then checks the signer certificate. The key is in these repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. A pull request that edits the workflow builds and checks the APKs but uploads nothing. Without the secrets, for example from a fork, it uses the debug key. A release without the secrets fails.

The workflow sets the Android version code from the version: `1.6.0` becomes `10600`. Each part must be below 100. Android installs an update only when its version code is higher. The last EAS build used version code 20. Before you make another EAS build, set its remote version code above the current release with `eas build:version:set`.

If a release has no APK, run the `Release apps` workflow by hand with the release tag.

The IPA is not signed. Install it with AltStore or SideStore, which sign it with your Apple ID. With a free Apple ID, refresh the app every 7 days.


