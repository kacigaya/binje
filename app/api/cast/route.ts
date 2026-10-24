import { NextRequest, NextResponse } from "next/server";
import { createCastToken } from "@/lib/cast-token";
import { isAllowedStreamHost } from "@/lib/hls-hosts";
import { getTargetUrl, isSafeHost } from "@/lib/safe-fetch";

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

export async function POST(request: NextRequest) {
  if (!isAllowedSender(request)) {
    return NextResponse.json(
      { error: "Cast sessions must be created from this site." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new Error("Invalid body.");
    }
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON target URL is required." }, {
      status: 400, headers: { "cache-control": "no-store" },
    });
  }
  if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" ||
    ("subtitles" in body && (!Array.isArray(body.subtitles) || body.subtitles.length > 100 ||
      body.subtitles.some((url: unknown) => typeof url !== "string")))) {
    return NextResponse.json({ error: "Invalid Cast targets." }, {
      status: 400, headers: { "cache-control": "no-store" },
    });
  }
  const targets: unknown[] = [body.url, ...("subtitles" in body && Array.isArray(body.subtitles) ? body.subtitles : [])];
  const hosts: string[] = [];
  for (const value of targets) {
    const target = getTargetUrl(typeof value === "string" ? value : null);
    if (!target || !isAllowedStreamHost(target) || !(await isSafeHost(target))) {
      return NextResponse.json({ error: "Target host is not allowed." }, {
        status: 403, headers: { "cache-control": "no-store" },
      });
    }
    hosts.push(target.host);
  }

  return NextResponse.json(
    { token: createCastToken(request.nextUrl.host, hosts) },
    { headers: { "cache-control": "no-store" } },
  );
}
