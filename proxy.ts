import { NextResponse, type NextRequest } from "next/server";
import { isLocale, preferredLocale } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const [, locale] = request.nextUrl.pathname.split("/");
  if (isLocale(locale)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get("accept-language"))}${url.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
