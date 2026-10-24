// Next's dev overlay and HMR runtime need eval; production builds do not.
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://www.gstatic.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com";

export const PAGE_CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "connect-src 'self' blob: data: https:",
  "media-src 'self' blob: data: https:",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

export const API_CSP = "default-src 'none'; sandbox";
