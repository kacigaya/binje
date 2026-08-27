import { NextRequest, NextResponse } from "next/server";
import { createCastToken } from "@/lib/cast-token";

function isAllowedSender(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  // Native senders do not attach browser origin metadata. A browser request
  // without Origin must not use this path if it still identifies as cross-site.
  if (!origin) return fetchSite === null;

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const expectedHost = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
    return new URL(origin).host === expectedHost && (!fetchSite || fetchSite === "same-origin");
  } catch {
    return false;
  }
}

export function POST(request: NextRequest) {
  if (!isAllowedSender(request)) {
    return NextResponse.json(
      { error: "Cast sessions must be created from this site." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { token: createCastToken() },
    { headers: { "cache-control": "no-store" } },
  );
}
