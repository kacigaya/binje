/**
 * Ad Blocker Service Worker
 *
 * Intercepts network requests and blocks those matching known ad domains.
 * Inspired by uBlock Origin's webRequest-based blocking.
 *
 * This SW intercepts fetch events for the main page scope and blocks
 * requests to ad/tracking domains before they reach the browser.
 */

// --- Ad domain blocklist (synced with lib/adblocker/domains.ts) ---
const AD_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "adnxs.com",
  "adsrvr.org",
  "adcolony.com",
  "adform.net",
  "admob.com",
  "adskeeper.co.uk",
  "adskeeper.com",
  "adsterra.com",
  "adtrue.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "propellerclick.com",
  "onclickmax.com",
  "onclickmega.com",
  "onclickrev.com",
  "clickadu.com",
  "clickadilla.com",
  "hilltopads.net",
  "hilltopads.com",
  "exoclick.com",
  "exosrv.com",
  "juicyads.com",
  "trafficjunky.com",
  "trafficfactory.biz",
  "tsyndicate.com",
  "revcontent.com",
  "revenuehits.com",
  "richpush.co",
  "a-ads.com",
  "ad-maven.com",
  "admaven.co",
  "bidsopt.com",
  "streamads.com",
  "vidoomy.com",
  "videoadex.com",
  "megaurl.in",
  "shrinkme.io",
  "linkvertise.com",
  "ouo.io",
  "ouo.press",
  "bc.vc",
  "adf.ly",
  "atglinks.com",
  "go.strm.sh",
  "newstracker.online",
  "pushnotification.com",
  "push-notification.com",
  "subscribeme.net",
  "subscribeto.me",
  "notifzone.com",
  "pushance.com",
  "pushwhy.com",
  "push.house",
  "whos.amung.us",
  "histats.com",
  "statcounter.com",
  "clevernt.com",
  "monetag.com",
  "surfe.pro",
  "disads.com",
  "dfrfrnt.com",
  "vfrfrnt.com",
  "onfasttrack.com",
  "onpushtracker.com",
  "rtbsystem.com",
  "btrll.com",
  "serving-sys.com",
  "eyereturn.com",
  "yieldmanager.com",
  "zedo.com",
  "undertone.com",
];

const ALLOWED_DOMAINS = [
  "player.videasy.net",
  "videasy.net",
  "api.themoviedb.org",
  "image.tmdb.org",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

const AD_PATH_PATTERNS = [
  /\/ads\//i,
  /\/adserv/i,
  /\/ad_/i,
  /\/ad\./i,
  /\/click\?/i,
  /\/popup/i,
  /\/popunder/i,
  /\/redirect\?/i,
  /\/track(er|ing)?\//i,
  /\/pixel\//i,
  /\/beacon\//i,
  /\/vast\/?\?/i,
  /\/vpaid/i,
  /\/sponsor/i,
];

// Build lookup set for O(1) matching
const blockedSet = new Set(AD_DOMAINS);
const allowedSet = new Set(ALLOWED_DOMAINS);

function isDomainInSet(hostname, domainSet) {
  if (domainSet.has(hostname)) return true;
  const parts = hostname.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (domainSet.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

function isAdRequest(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Never block allowed domains
    if (isDomainInSet(hostname, allowedSet)) return false;

    // Block known ad domains
    if (isDomainInSet(hostname, blockedSet)) return true;

    // Block matching path patterns
    const fullPath = parsed.pathname + parsed.search;
    for (const pattern of AD_PATH_PATTERNS) {
      if (pattern.test(fullPath)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// --- Service Worker lifecycle ---

self.addEventListener("install", (event) => {
  // Activate immediately, don't wait for existing SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all open pages immediately
  event.waitUntil(self.clients.claim());
});

// --- Fetch interception ---

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept navigations and subresource requests
  if (isAdRequest(request.url)) {
    console.debug("[SW-AdBlocker] Blocked:", request.url);
    // Return an empty response (204 No Content) for blocked requests
    event.respondWith(
      new Response(null, {
        status: 204,
        statusText: "Blocked by AdBlocker",
      }),
    );
    return;
  }

  // Let all other requests pass through normally
});
