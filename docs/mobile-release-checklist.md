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
- [ ] Verify VO and VF playback on both platforms
- [ ] Verify Google Cast discovery, playback transfer, subtitles, progress, and disconnect resume on Android and iOS
- [ ] Verify TV season and episode selection
- [ ] Verify consent, watchlist, history, and clear-data behavior
- [ ] Verify English and French layouts
- [ ] Verify Android back navigation and iOS gestures
- [ ] Verify no secrets exist in public Expo config or exported bundles
- [ ] Build internal preview binaries
- [ ] Obtain explicit approval before store submission

## Publish a release

1. Set `expo.version` in `apps/mobile/app.json` and `version` in `package.json` to the new version.
2. Merge the change to `main`.
3. Publish a GitHub release with tag `vX.Y.Z` that matches `expo.version`.
4. The `Release apps` workflow builds the Android APK on EAS with the `preview` profile.
5. The same workflow builds an unsigned iOS IPA on a macOS runner.
6. The workflow attaches `binje-vX.Y.Z.apk`, `binje-vX.Y.Z.ipa`, and their SHA-256 files to the release.

The workflow needs the `EXPO_TOKEN` repository secret. EAS increments the Android version code for each build.

The IPA is not signed. Install it with AltStore or SideStore, which sign it with your Apple ID. With a free Apple ID, refresh the app every 7 days.

A pull request that edits `.github/workflows/release.yml` builds the IPA as a check. It does not use EAS and does not upload files.
