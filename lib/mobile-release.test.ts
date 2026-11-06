import { expect, test } from "bun:test";
import { parseRelease } from "./mobile-release";

const base = "https://github.com/kacigaya/binje/releases";
const asset = (name: string, url = `${base}/download/v1.5.0/${name}`) => ({ name, browser_download_url: url });

test("maps release assets to platform downloads", () => {
  expect(parseRelease({
    tag_name: "v1.5.0",
    html_url: `${base}/tag/v1.5.0`,
    assets: [asset("binje-v1.5.0.apk"), asset("binje-v1.5.0-tv.apk"), asset("binje-v1.5.0.apk.sha256"), asset("binje-v1.5.0.ipa", "https://evil.test/binje-v1.5.0.ipa")],
  })).toEqual({
    version: "1.5.0",
    url: `${base}/tag/v1.5.0`,
    android: `${base}/download/v1.5.0/binje-v1.5.0.apk`,
    androidTv: `${base}/download/v1.5.0/binje-v1.5.0-tv.apk`,
    ios: null,
  });
});

test("rejects tags and pages outside the app release format", () => {
  expect(() => parseRelease({ tag_name: "nightly", html_url: `${base}/tag/nightly` })).toThrow();
  expect(() => parseRelease({ tag_name: "v1.5.0", html_url: "https://evil.test/v1.5.0" })).toThrow();
  expect(() => parseRelease(null)).toThrow();
});
