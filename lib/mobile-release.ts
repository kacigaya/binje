import { isRecord } from "@/lib/stream-check";
import type { MobileRelease } from "@/types/mobile-api";

export const RELEASE_REPOSITORY = "kacigaya/binje";
const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/`;

// The release workflow names assets binje-vX.Y.Z.apk, binje-vX.Y.Z-tv.apk and binje-vX.Y.Z.ipa.
export function parseRelease(body: unknown): MobileRelease {
  if (!isRecord(body) || typeof body.tag_name !== "string" || typeof body.html_url !== "string") throw new Error("Invalid release.");
  const version = /^v(\d+\.\d+\.\d+)$/.exec(body.tag_name)?.[1];
  if (!version || !body.html_url.startsWith(RELEASES_URL)) throw new Error("Invalid release.");
  const assets = new Map<string, string>();
  for (const asset of Array.isArray(body.assets) ? body.assets : []) {
    if (isRecord(asset) && typeof asset.name === "string" && typeof asset.browser_download_url === "string" && asset.browser_download_url.startsWith(`${RELEASES_URL}download/`)) {
      assets.set(asset.name, asset.browser_download_url);
    }
  }
  const name = `binje-${body.tag_name}`;
  return {
    version,
    url: body.html_url,
    android: assets.get(`${name}.apk`) ?? null,
    androidTv: assets.get(`${name}-tv.apk`) ?? null,
    ios: assets.get(`${name}.ipa`) ?? null,
  };
}
