import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PLAYER_HOST = "player.videasy.net";
const BLOCKED_SUBSTRINGS = [
  "users.videasy.net/api/script.js",
  "users.videasy.net/api/track",
  "/scripts/ab.js",
  ".cfd/",
  ".rest/",
];

function isAllowedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === ALLOWED_PLAYER_HOST;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("src");

  if (!raw || !isAllowedSource(raw)) {
    return new NextResponse("Invalid embed source", { status: 400 });
  }

  const embedUrl = new URL(raw);
  const upstream = await fetch(embedUrl.toString(), {
    cache: "no-store",
    headers: {
      "user-agent": "binje-embed-proxy",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!upstream.ok) {
    return new NextResponse("Failed to load player source", { status: 502 });
  }

  const originalHtml = await upstream.text();
  const blockerScript = `<script>
(() => {
  const blocked = ${JSON.stringify(BLOCKED_SUBSTRINGS)};
  const normalize = (value) => {
    try {
      return new URL(String(value || ""), location.href).href;
    } catch {
      return String(value || "");
    }
  };
  const isBlocked = (value) => {
    const url = normalize(value);
    return blocked.some((pattern) => url.includes(pattern));
  };

  const nativeOpen = window.open;
  window.open = (...args) => {
    const url = String(args[0] || "");
    if (!url || isBlocked(url)) return null;
    return nativeOpen(...args);
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input && input.url;
    if (isBlocked(url)) {
      return Promise.resolve(new Response("", { status: 204 }));
    }
    return nativeFetch(input, init);
  };

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  const nativeXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__blocked = isBlocked(url);
    if (this.__blocked) return;
    return nativeXhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    if (this.__blocked) {
      if (typeof this.onreadystatechange === "function") {
        this.readyState = 4;
        this.status = 0;
        this.onreadystatechange();
      }
      return;
    }
    return nativeXhrSend.apply(this, args);
  };

  if (navigator.sendBeacon) {
    const nativeBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (isBlocked(url)) return true;
      return nativeBeacon(url, data);
    };
  }

  const nativeAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function(node) {
    try {
      if (node && node.tagName === "SCRIPT" && node.src && isBlocked(node.src)) {
        return node;
      }
      if (node && node.tagName === "IFRAME" && node.src && isBlocked(node.src)) {
        return node;
      }
    } catch {
      return nativeAppendChild.call(this, node);
    }
    return nativeAppendChild.call(this, node);
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (isBlocked(href) || link.target === "_blank") {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  const removeBlockedNodes = () => {
    const nodes = document.querySelectorAll("script[src], iframe[src], a[href]");
    for (const node of nodes) {
      const src = node.getAttribute("src") || node.getAttribute("href") || "";
      if (src && isBlocked(src)) {
        node.remove();
      }
    }
  };

  new MutationObserver(removeBlockedNodes).observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  removeBlockedNodes();
})();
</script>`;

  const withoutKnownScripts = originalHtml
    .replace(
      /<script[^>]+src=["'][^"']*users\.videasy\.net\/api\/script\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    )
    .replace(
      /<script[^>]+src=["'][^"']*\/scripts\/ab\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    );

  const injectedHtml = withoutKnownScripts.replace(
    /<head(.*?)>/i,
    `<head$1><base href="https://${ALLOWED_PLAYER_HOST}/">${blockerScript}`,
  );

  return new NextResponse(injectedHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
    },
  });
}
