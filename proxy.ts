import { NextResponse, type NextRequest } from "next/server";
import { isLocale, preferredLocale } from "@/lib/i18n";
import { clientIp, isRateLimited, retryAfterSeconds } from "@/lib/rate-limit";
import { PAGE_CSP } from "@/lib/security-headers";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const ip = clientIp(request.headers);
    if (!isRateLimited(ip, pathname)) return NextResponse.next();
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, retryAfterSeconds(ip, pathname))) },
      },
    );
  }

  const [, locale] = pathname.split("/");
  if (isLocale(locale)) {
    return NextResponse.next({ headers: { "Content-Security-Policy": PAGE_CSP } });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get("accept-language"))}${url.pathname}`;
  return NextResponse.redirect(url, { headers: { "Content-Security-Policy": PAGE_CSP } });
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
