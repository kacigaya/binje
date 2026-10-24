import type { NextConfig } from "next";
import { API_CSP } from "./lib/security-headers";

const isInstantTestBuild = process.env.NEXT_INSTANT_TEST === "1";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    exposeTestingApiInProductionBuild: isInstantTestBuild,
  },
  output: isInstantTestBuild ? undefined : "standalone",
  poweredByHeader: false,
  images: {
    // WebP only: TMDB JPEGs are already right-sized and AVIF encoding is slow.
    formats: ["image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1280, 1920, 2048],
    imageSizes: [92, 154, 185, 300, 342, 500, 780],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Unset, Next claims half the free disk; past this cap it evicts LRU entries.
    maximumDiskCacheSize: 2_000_000_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Nothing opens a popup or touches window.opener, so the strictest value is safe.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [{ key: "Content-Security-Policy", value: API_CSP }],
    },
  ],
};

export default nextConfig;
