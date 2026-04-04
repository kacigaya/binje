"use client";

import { AD_DOMAINS, AD_PATH_PATTERNS, ALLOWED_DOMAINS } from "./domains";

/**
 * AdBlocker — A client-side TypeScript ad blocker inspired by uBlock Origin.
 *
 * Techniques used:
 * 1. Popup interception — Overrides window.open and blocks ad-triggered popups
 * 2. Navigation hijack prevention — Blocks ad scripts from redirecting the page
 * 3. Click hijack detection — Intercepts suspicious click handlers on the document
 * 4. DOM mutation observer — Removes injected ad elements from the parent page
 * 5. Service Worker registration — Blocks ad network requests at the fetch level
 */
export class AdBlocker {
  private active = false;
  private originalWindowOpen: typeof window.open | null = null;
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

    // Check parent domains: a.b.example.com → b.example.com → example.com
    const parts = hostname.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (domainSet.has(parent)) return true;
    }

    return false;
  }

  /**
   * 1. Popup Interception
   * Override window.open to block popups to ad domains.
   * Mimics uBlock's popup blocking by intercepting the window.open API.
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

      // Block if it's an ad URL or if opened without user gesture (empty URL popup trick)
      if (!urlStr || self.isAdURL(urlStr)) {
        console.debug("[AdBlocker] Blocked popup:", urlStr || "(empty)");
        return null;
      }

      // Allow legitimate popups
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
   * Prevents ad scripts from redirecting the parent page via location changes.
   * Blocks beforeunload-based redirects and monitors location descriptor changes.
   */
  private blockNavigationHijacks(): void {
    // Capture the original location descriptor
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "location",
    );

    // Block suspicious beforeunload handlers that ads inject
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If the navigation is to an ad URL, prevent it
      // We check document.activeElement to see if the user was interacting with our iframe
      const activeEl = document.activeElement;
      if (activeEl?.tagName === "IFRAME") {
        // Likely an ad-triggered navigation from inside the player iframe
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    this.cleanupHandlers.push(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });
  }

  /**
   * 3. Click Hijack Interception
   * Detects and neutralizes click event handlers injected by ad scripts that
   * try to intercept user clicks to trigger popups or redirects.
   */
  private interceptClickHijacks(): void {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if a click on the page (outside the iframe) is trying to open an ad
      if (target.tagName === "A") {
        const anchor = target as HTMLAnchorElement;
        if (
          anchor.href &&
          this.isAdURL(anchor.href) &&
          anchor.target === "_blank"
        ) {
          e.preventDefault();
          e.stopPropagation();
          console.debug("[AdBlocker] Blocked ad link click:", anchor.href);
        }
      }
    };

    // Use capture phase to intercept before ad scripts
    document.addEventListener("click", handleClick, true);
    this.cleanupHandlers.push(() => {
      document.removeEventListener("click", handleClick, true);
    });

    // Block auxclick (middle-click popups)
    const handleAuxClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const anchor = target as HTMLAnchorElement;
        if (anchor.href && this.isAdURL(anchor.href)) {
          e.preventDefault();
          e.stopPropagation();
          console.debug(
            "[AdBlocker] Blocked ad auxclick:",
            anchor.href,
          );
        }
      }
    };

    document.addEventListener("auxclick", handleAuxClick, true);
    this.cleanupHandlers.push(() => {
      document.removeEventListener("auxclick", handleAuxClick, true);
    });
  }

  /**
   * 4. DOM Mutation Observer
   * Watches for ad elements injected into the parent document by scripts that
   * escape iframe sandboxing. Removes iframes, scripts, and divs that load ad content.
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

          // Remove suspicious overlay divs (full-screen ad overlays)
          if (
            node.tagName === "DIV" &&
            node.style &&
            node.style.position === "fixed" &&
            node.style.zIndex &&
            parseInt(node.style.zIndex) > 9000
          ) {
            // Check if it contains ad-related content
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

          // Check children of added nodes too
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
   * 5. Service Worker Registration
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
