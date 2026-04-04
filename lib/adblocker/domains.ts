/**
 * Known ad, tracking, and popup domains commonly used by video embed players.
 * Inspired by uBlock Origin filter lists and community-maintained blocklists.
 *
 * These are matched against hostnames in network requests and popup URLs.
 */
export const AD_DOMAINS: string[] = [
  // Common ad networks
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

  // Popup / redirect ad networks
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

  // Streaming/video specific ad domains
  "streamads.com",
  "vidoomy.com",
  "videoadex.com",
  "vid.me",
  "megaurl.in",
  "shrinkme.io",
  "linkvertise.com",
  "ouo.io",
  "ouo.press",
  "bc.vc",
  "adf.ly",
  "atglinks.com",

  // Malvertising / suspicious redirect domains
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

  // Tracker / fingerprinting
  "amplitude.com",
  "mixpanel.com",
  "segment.io",
  "hotjar.com",
  "mouseflow.com",
  "fullstory.com",
  "crazyegg.com",
  "optimizely.com",

  // Known embed-player ad domains
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

  // Generic suspicious TLDs / patterns
  "btrll.com",
  "serving-sys.com",
  "eyereturn.com",
  "yieldmanager.com",
  "zedo.com",
  "undertone.com",
];

/**
 * URL path patterns that indicate ad/tracking content.
 * Matched against the pathname of requests.
 */
export const AD_PATH_PATTERNS: RegExp[] = [
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
  /\.doubleclick\./i,
];

/**
 * Allowed domains that should never be blocked (whitelist).
 */
export const ALLOWED_DOMAINS: string[] = [
  "player.videasy.net",
  "videasy.net",
  "api.themoviedb.org",
  "image.tmdb.org",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];
