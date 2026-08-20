import type { NextConfig } from "next";
import { CAST_COMPANION_ORIGIN } from "./lib/tab-cast";

// Next's dev overlay and HMR runtime need eval; production builds do not.
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://www.gstatic.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com";

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  // The cast companion is a loopback service; browsers treat it as a secure
  // origin, but the connect-src allowlist still has to name it explicitly.
  `connect-src 'self' blob: data: https: ${CAST_COMPANION_ORIGIN}`,
  "media-src 'self' blob: data: https:",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    // WebP only. TMDB already serves right-sized JPEGs, so AVIF bought a few
    // KB per poster in exchange for the slowest encoder in the optimizer, on a
    // box that also proxies HLS segments.
    formats: ["image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1280, 1920, 2048],
    imageSizes: [92, 154, 185, 300, 342, 500, 780],
    minimumCacheTTL: 60 * 60 * 24 * 30,
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
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: CSP },
      ],
    },
    {
      source: "/api/mobile/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
    // /api/hls is deliberately absent: the segment proxy is same-origin only,
    // so no third-party page can drive it from a browser.
    {
      source: "/api/(search|resolve|resolve-vf|episodes)",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
  ],
};

export default nextConfig;
