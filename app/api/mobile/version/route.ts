import { NextResponse } from "next/server";
import { parseRelease, RELEASE_REPOSITORY } from "@/lib/mobile-release";
import { fetchJson } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";
import type { MobileRelease } from "@/types/mobile-api";
import { mobileJson } from "../_utils";

// Apps ask on launch. One GitHub request per window stays far below its anonymous rate limit.
const cache = createTtlCache<MobileRelease>(15 * 60 * 1000, 1);

export const versionDependencies = { fetchJson };

/** The latest published app release, so installed apps can offer an update without contacting GitHub. */
export async function GET() {
  try {
    const release = await cache.get("latest", async () => parseRelease(await versionDependencies.fetchJson(
      `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`,
      { userAgent: "binje", headers: { accept: "application/vnd.github+json" } },
    )));
    // Shorter than the media routes: a new release must reach apps within the cache window.
    return NextResponse.json(release, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (error) {
    console.error("Mobile version check failed", error);
    return mobileJson({ error: { code: "UPSTREAM_ERROR", message: "Unable to check for updates." } }, 502, false);
  }
}
