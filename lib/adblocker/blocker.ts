"use client";

import { AD_DOMAINS, AD_PATH_PATTERNS, ALLOWED_DOMAINS } from "./domains";

/**
 * AdBlocker — A client-side TypeScript ad blocker inspired by uBlock Origin.
 *
 * Techniques used (mirrors uBlock Origin scriptlets):
 * 1. Popup interception — Overrides window.open with a fake Proxy window (nowoif)
 * 2. Navigation hijack prevention — Blocks ad-triggered page redirects
 * 3. Click hijack detection — Intercepts suspicious click handlers
 * 4. addEventListener interception — Filters ad-injected event listeners
 * 5. DOM mutation observer — Removes injected ad elements + strips target=_blank
 * 6. Synthetic click blocking — Prevents HTMLElement.prototype.click abuse
 * 7. Service Worker registration — Blocks ad network requests at fetch level
 */
export class AdBlocker {
  private active = false;
  private originalWindowOpen: typeof window.open | null = null;
  private originalAddEventListener: typeof EventTarget.prototype.addEventListener | null = null;
  private originalElementClick: typeof HTMLElement.prototype.click | null = null;
  private observer: MutationObserver | null = null;
  private cleanupHandlers: (() => void)[] = [];

  /** Hostname lookup set built from the domain blocklist for O(1) matching */
  private blockedDomains: Set<string>;
  private allowedDomains: Set<string>;

  constructor() {
    this.blockedDomains = new Set(AD_DOMAINS.map((d) => d.toLowerCase()));
    this.allowedDomains = new Set(ALLOWED_DOMAINS.map((d) => d.toLowerCase()));
  }

  /**
   * Activate all ad-blocking protections.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    this.interceptPopups();
    this.blockNavigationHijacks();
    this.interceptClickHijacks();
    this.interceptAddEventListener();
    this.interceptSyntheticClicks();
    this.observeDOM();
    this.registerServiceWorker();
  }

  /**
   * Deactivate all protections and restore originals.
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const cleanup of this.cleanupHandlers) {
      cleanup();
    }
    this.cleanupHandlers = [];

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Check if a URL belongs to a known ad domain.
   */
  isAdURL(urlString: string): boolean {
    try {
      const url = new URL(urlString, window.location.origin);
      const hostname = url.hostname.toLowerCase();

      // Never block allowed domains
      if (this.isDomainInList(hostname, this.allowedDomains)) {
        return false;
      }

      // Check against blocked domains
      if (this.isDomainInList(hostname, this.blockedDomains)) {
        return true;
      }

      // Check path patterns
      for (const pattern of AD_PATH_PATTERNS) {
        if (pattern.test(url.pathname + url.search)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Match a hostname against a set of domains, including subdomain matching.
   * e.g., "ads.example.doubleclick.net" matches "doubleclick.net"
   */
  private isDomainInList(hostname: string, domainSet: Set<string>): boolean {
    if (domainSet.has(hostname)) return true;

    const parts = hostname.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (domainSet.has(parent)) return true;
    }

    return false;
  }

  /**
   * Create a fake window Proxy that tricks ad scripts into thinking
   * their popup succeeded. This is uBlock Origin's "nowoif" technique.
   * Ad scripts check the return value of window.open() — if they get null,
   * they retry or fall back to redirect-based ads. A fake Proxy prevents that.
   */
  private createDecoyWindow(): Window {
    const noop = () => {};
    const decoy = new Proxy(Object.create(null), {
      get(_target, prop) {
        switch (prop) {
          case "closed":
            return false;
          case "document":
            return new Proxy(Object.create(null), {
              get() {
                return noop;
              },
            });
          case "focus":
          case "blur":
          case "close":
          case "moveTo":
          case "moveBy":
          case "resizeTo":
          case "resizeBy":
          case "scroll":
          case "scrollTo":
          case "scrollBy":
          case "postMessage":
          case "print":
          case "stop":
          case "alert":
          case "confirm":
          case "prompt":
            return noop;
          case "location":
            return new Proxy(Object.create(null), {
              get() {
                return "";
              },
              set() {
                return true;
              },
            });
          case "top":
          case "self":
          case "parent":
          case "opener":
          case "window":
            return decoy;
          default:
            return undefined;
        }
      },
      set() {
        return true;
      },
    });
    return decoy as unknown as Window;
  }

  /**
   * 1. Popup Interception (uBlock's nowoif / prevent-window-open)
   * Override window.open to block popups to ad domains.
   * Returns a decoy Proxy window so ad scripts think the popup succeeded.
   */
  private interceptPopups(): void {
    this.originalWindowOpen = window.open.bind(window);

    const self = this;
    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string,
    ): Window | null {
      const urlStr = url?.toString() ?? "";

      // Block if it's an ad URL or empty URL (popup trick)
      if (!urlStr || self.isAdURL(urlStr)) {
        console.debug("[AdBlocker] Blocked popup:", urlStr || "(empty)");
        return self.createDecoyWindow();
      }

      return self.originalWindowOpen!(url, target, features);
    };

    this.cleanupHandlers.push(() => {
      if (this.originalWindowOpen) {
        window.open = this.originalWindowOpen;
        this.originalWindowOpen = null;
      }
    });
  }

  /**
   * 2. Navigation Hijack Prevention
   * Prevents ad scripts from redirecting the parent page.
   * Intercepts both beforeunload events and location assignment.
   */
  private blockNavigationHijacks(): void {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === "IFRAME") {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    this.cleanupHandlers.push(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });

    // Intercept location.assign and location.replace to block ad redirects
    const origAssign = window.location.assign.bind(window.location);
    const origReplace = window.location.replace.bind(window.location);
    const self = this;

    window.location.assign = function (url: string | URL) {
      const urlStr = url.toString();
      if (self.isAdURL(urlStr)) {
        console.debug("[AdBlocker] Blocked location.assign:", urlStr);
        return;
      }
      return origAssign(url);
    };

    window.location.replace = function (url: string | URL) {
      const urlStr = url.toString();
      if (self.isAdURL(urlStr)) {
        console.debug("[AdBlocker] Blocked location.replace:", urlStr);
        return;
      }
      return origReplace(url);
    };

    this.cleanupHandlers.push(() => {
      window.location.assign = origAssign;
      window.location.replace = origReplace;
    });
  }

  /**
   * 3. Click Hijack Interception
   * Detects and neutralizes click handlers injected by ad scripts.
   * Uses capture phase to intercept before ad scripts.
   */
  private interceptClickHijacks(): void {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Block ad link clicks
      if (target.tagName === "A") {
        const anchor = target as HTMLAnchorElement;
        if (anchor.href && this.isAdURL(anchor.href)) {
          e.preventDefault();
          e.stopPropagation();
          console.debug("[AdBlocker] Blocked ad link click:", anchor.href);
        }
      }

      // Also check parent elements (ad links often wrap content)
      const adLink = target.closest?.("a");
      if (
        adLink &&
        adLink !== target &&
        adLink.href &&
        this.isAdURL(adLink.href)
      ) {
        e.preventDefault();
        e.stopPropagation();
        console.debug("[AdBlocker] Blocked nested ad link:", adLink.href);
      }
    };

    document.addEventListener("click", handleClick, true);
    this.cleanupHandlers.push(() => {
      document.removeEventListener("click", handleClick, true);
    });

    const handleAuxClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link =
        target.tagName === "A"
          ? (target as HTMLAnchorElement)
          : target.closest?.("a");
      if (link?.href && this.isAdURL(link.href)) {
        e.preventDefault();
        e.stopPropagation();
        console.debug("[AdBlocker] Blocked ad auxclick:", link.href);
      }
    };

    document.addEventListener("auxclick", handleAuxClick, true);
    this.cleanupHandlers.push(() => {
      document.removeEventListener("auxclick", handleAuxClick, true);
    });
  }

  /**
   * 4. addEventListener Interception
   * Wraps EventTarget.prototype.addEventListener to monitor and filter
   * click handlers added by ad scripts. Inspired by uBlock's
   * abort-current-script technique.
   */
  private interceptAddEventListener(): void {
    this.originalAddEventListener =
      EventTarget.prototype.addEventListener.bind(document);
    const origAddListener = EventTarget.prototype.addEventListener;
    const self = this;

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      // Check if a click/mousedown listener on document/body is trying to open popups
      if (
        (type === "click" || type === "mousedown" || type === "pointerdown") &&
        (this === document ||
          this === document.body ||
          this === document.documentElement ||
          this === window)
      ) {
        const listenerStr = listener?.toString() ?? "";
        // Detect listeners that reference popup-related APIs
        if (
          listenerStr.includes("window.open") ||
          listenerStr.includes("window.location") ||
          listenerStr.includes(".open(") ||
          listenerStr.includes("location.href") ||
          listenerStr.includes("location.assign") ||
          listenerStr.includes("location.replace")
        ) {
          console.debug(
            "[AdBlocker] Blocked suspicious",
            type,
            "listener on",
            this === window ? "window" : (this as HTMLElement).tagName,
          );
          return;
        }
      }

      return origAddListener.call(this, type, listener, options);
    };

    this.cleanupHandlers.push(() => {
      EventTarget.prototype.addEventListener = origAddListener;
    });
  }

  /**
   * 5. Synthetic Click Blocking
   * Prevents ad scripts from programmatically clicking invisible anchor tags
   * via HTMLElement.prototype.click(). This is a common technique to bypass
   * popup blockers — create an <a target="_blank" href="ad-url">, then call .click().
   */
  private interceptSyntheticClicks(): void {
    this.originalElementClick = HTMLElement.prototype.click;
    const origClick = HTMLElement.prototype.click;
    const self = this;

    HTMLElement.prototype.click = function () {
      if (this.tagName === "A") {
        const anchor = this as unknown as HTMLAnchorElement;
        if (anchor.href && self.isAdURL(anchor.href)) {
          console.debug(
            "[AdBlocker] Blocked synthetic click on ad link:",
            anchor.href,
          );
          return;
        }
      }
      return origClick.call(this);
    };

    this.cleanupHandlers.push(() => {
      HTMLElement.prototype.click = origClick;
    });
  }

  /**
   * 6. DOM Mutation Observer
   * Watches for ad elements injected into the parent document.
   * - Removes ad iframes, scripts, and overlay divs
   * - Strips target="_blank" from dynamically created links to ad URLs
   *   (uBlock's disable-newtab-links technique)
   * - Removes <meta http-equiv="refresh"> tags (prevent-refresh technique)
   */
  private observeDOM(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Remove injected ad iframes
          if (node.tagName === "IFRAME") {
            const src = node.getAttribute("src") ?? "";
            if (src && this.isAdURL(src)) {
              console.debug("[AdBlocker] Removed ad iframe:", src);
              node.remove();
              continue;
            }
          }

          // Remove injected ad scripts
          if (node.tagName === "SCRIPT") {
            const src = node.getAttribute("src") ?? "";
            if (src && this.isAdURL(src)) {
              console.debug("[AdBlocker] Removed ad script:", src);
              node.remove();
              continue;
            }
          }

          // Remove <meta http-equiv="refresh"> tags (uBlock's prevent-refresh)
          if (node.tagName === "META") {
            const httpEquiv = node.getAttribute("http-equiv") ?? "";
            if (httpEquiv.toLowerCase() === "refresh") {
              console.debug("[AdBlocker] Removed meta refresh tag");
              node.remove();
              continue;
            }
          }

          // Strip target="_blank" from ad links (disable-newtab-links)
          if (node.tagName === "A") {
            const anchor = node as HTMLAnchorElement;
            if (
              anchor.href &&
              this.isAdURL(anchor.href) &&
              anchor.target === "_blank"
            ) {
              anchor.removeAttribute("target");
              anchor.addEventListener(
                "click",
                (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                },
                true,
              );
              console.debug(
                "[AdBlocker] Neutralized ad link:",
                anchor.href,
              );
            }
          }

          // Remove suspicious overlay divs (full-screen ad overlays)
          if (
            node.tagName === "DIV" &&
            node.style &&
            node.style.position === "fixed" &&
            node.style.zIndex &&
            parseInt(node.style.zIndex) > 9000
          ) {
            const innerHTML = node.innerHTML.toLowerCase();
            if (
              innerHTML.includes("ad") ||
              innerHTML.includes("sponsor") ||
              innerHTML.includes("click") ||
              node.querySelectorAll("iframe, a[target='_blank']").length > 0
            ) {
              console.debug("[AdBlocker] Removed ad overlay div");
              node.remove();
              continue;
            }
          }

          // Check children of added nodes
          const adElements = node.querySelectorAll(
            'iframe[src], script[src], a[target="_blank"]',
          );
          adElements.forEach((el) => {
            const src =
              el.getAttribute("src") ?? el.getAttribute("href") ?? "";
            if (src && this.isAdURL(src)) {
              console.debug("[AdBlocker] Removed nested ad element:", src);
              el.remove();
            }
          });
        }
      }
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 7. Service Worker Registration
   * Registers a service worker that intercepts fetch requests at the network level
   * and blocks requests to known ad domains before they reach the page.
   */
  private registerServiceWorker(): void {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw-adblocker.js", { scope: "/" })
      .then((reg) => {
        console.debug("[AdBlocker] Service Worker registered:", reg.scope);
      })
      .catch((err) => {
        console.debug("[AdBlocker] Service Worker registration failed:", err);
      });
  }
}

/** Singleton instance */
let instance: AdBlocker | null = null;

export function getAdBlocker(): AdBlocker {
  if (!instance) {
    instance = new AdBlocker();
  }
  return instance;
}
