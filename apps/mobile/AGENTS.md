# Mobile project facts

- Expo 57, React Native 0.86, React 19.2.3. Package manager: Bun 1.4.0 at the repository root.
- Native package versions follow `expo/bundledNativeModules.json`. Expo 57 expects
  `react-native-gesture-handler` on `~2.32.0`; upgrade its major with the Expo SDK.
- `react-native` is aliased to `react-native-tvos` with an exact version in `apps/mobile/package.json`
  and in the root `overrides`. Keep both on the same version. Bun cannot resolve a dist-tag
  such as `0.86-stable` inside an `npm:` alias. Without the root override, Bun installs stock
  `react-native` copies for peer dependencies.
- `EXPO_TV=1` makes prebuild and EAS (`development_tv`, `preview_tv`) target Android TV.
  Gate TV-only UI on `Platform.isTV` so phone behavior does not change.
- Validation from the repository root: `bun run mobile:typecheck`,
  `bun run mobile:test --runInBand`, and `bun run mobile:lint`.
- Check SDK compatibility from this directory with `bunx expo install --check`.
- Toast tests use fake timers with asynchronous advancement so press events and
  React Native animation callbacks settle before assertions.

- CI validates both native JavaScript bundles with Hermes on an x64 runner.
  On ARM Linux, use `expo export --no-bytecode` because the supplied Hermes compiler is x64.
- The web production build prerenders TMDB pages and requires `TMDB_API_KEY`.
  CI checks web lint, tests, and types without copying deployment credentials.
