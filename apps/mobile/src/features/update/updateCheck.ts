import type { MobileRelease } from "../../types/api";

function parts(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? match.slice(1).map(Number) : null;
}

/** False when either version is not plain X.Y.Z, so a malformed value never prompts. */
export function isNewerVersion(latest: string, installed: string) {
  const next = parts(latest);
  const current = parts(installed);
  if (!next || !current) return false;
  for (let index = 0; index < 3; index++) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

/**
 * Android opens the matching APK, which the browser downloads. iOS opens the release page:
 * AltStore and SideStore users install from there.
 */
export function updateUrl(release: MobileRelease, platform: { os: string; isTV: boolean }) {
  if (platform.os === "android") return (platform.isTV ? release.androidTv : release.android) ?? release.url;
  return release.url;
}
