import { isNewerVersion, updateUrl } from "../updateCheck";

const release = { version: "1.5.0", url: "https://github.com/kacigaya/binje/releases/tag/v1.5.0", android: "https://x.test/a.apk", androidTv: null, ios: "https://x.test/a.ipa" };

test("compares each version part as a number", () => {
  expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
  expect(isNewerVersion("v2.0.0", "1.99.99")).toBe(true);
  expect(isNewerVersion("1.4.0", "1.4.0")).toBe(false);
  expect(isNewerVersion("1.3.9", "1.4.0")).toBe(false);
  expect(isNewerVersion("1.5.0-beta", "1.4.0")).toBe(false);
});

test("opens the APK on Android, the release page elsewhere or when the build is missing", () => {
  expect(updateUrl(release, { os: "android", isTV: false })).toBe(release.android);
  expect(updateUrl(release, { os: "android", isTV: true })).toBe(release.url);
  expect(updateUrl(release, { os: "ios", isTV: false })).toBe(release.url);
});
