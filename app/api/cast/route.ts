import { NextRequest, NextResponse } from "next/server";
import { createCastToken } from "@/lib/cast-token";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const expectedHost = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
    const fetchSite = request.headers.get("sec-fetch-site");
    return new URL(origin).host === expectedHost && (!fetchSite || fetchSite === "same-origin");
  } catch {
    return false;
  }
}

export function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
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
