import { NextResponse, type NextRequest } from "next/server";
import { isLocale, preferredLocale } from "@/lib/i18n";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return isRateLimited(clientIp(request.headers), pathname)
      ? NextResponse.json({ error: "Too many requests" }, { status: 429 })
      : NextResponse.next();
  }

  const [, locale] = pathname.split("/");
  if (isLocale(locale)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get("accept-language"))}${url.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
