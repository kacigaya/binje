import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "player.videasy.net";

function isAllowedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === ALLOWED_HOST;
  } catch {
    return false;
  }
}

function stripKnownAdScripts(html: string) {
  return html
    .replace(
      /<script[^>]+src=["'][^"']*\/scripts\/ab\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    )
    .replace(
      /<script[^>]+src=["'][^"']*users\.videasy\.net\/api\/script\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    );
}

function injectProtections(html: string) {
  const baseTag = `<base href="https://${ALLOWED_HOST}/">`;
  const blocker = `<script>
(() => {
  const blockedHosts = ["whitebit.com", "www.whitebit.com"];

  const normalize = (value) => {
    try {
      return new URL(String(value || ""), window.location.href);
    } catch {
      return null;
    }
  };

  const isBlocked = (value) => {
    const url = normalize(value);
    if (!url) return false;
    return blockedHosts.some((host) => url.hostname === host || url.hostname.endsWith("." + host));
  };

  const nativeOpen = window.open;
  window.open = (...args) => {
    const url = args[0];
    if (isBlocked(url)) return null;
    return nativeOpen(...args);
  };

  const nativeAssign = Location.prototype.assign;
  Location.prototype.assign = function(url) {
    if (isBlocked(url)) return;
    return nativeAssign.call(this, url);
  };

  const nativeReplace = Location.prototype.replace;
  Location.prototype.replace = function(url) {
    if (isBlocked(url)) return;
    return nativeReplace.call(this, url);
  };

  const nativePushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    try {
      return nativePushState(...args);
    } catch {
      return;
    }
  };

  const nativeReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    try {
      return nativeReplaceState(...args);
    } catch {
      return;
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || !isBlocked(href)) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
})();
</script>`;

  return html.replace(/<head(.*?)>/i, `<head$1>${baseTag}${blocker}`);
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");

  if (!src || !isAllowedSource(src)) {
    return new NextResponse("Invalid source", { status: 400 });
  }

  const upstream = await fetch(src, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!upstream.ok) {
    return new NextResponse("Failed to load source", { status: 502 });
  }

  const html = await upstream.text();
  const cleaned = injectProtections(stripKnownAdScripts(html));

  return new NextResponse(cleaned, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
