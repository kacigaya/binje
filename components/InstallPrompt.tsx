"use client";

import { useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "binje:install-dismissed";

type PromptMode = "hidden" | "android" | "ios";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function computeMode(): PromptMode {
  if (typeof window === "undefined") return "hidden";

  // Already installed / running as an installed app.
  if (window.matchMedia("(display-mode: standalone)").matches) return "hidden";
  if ((window.navigator as { standalone?: boolean }).standalone) return "hidden";

  if (isDismissed()) return "hidden";

  // Mobile only.
  const isMobile =
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;
  if (!isMobile) return "hidden";

  // Android / Chromium: native install available.
  if (deferredPrompt) return "android";

  // iOS Safari never fires beforeinstallprompt — guide the user manually.
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
  if (isIOS && isSafari) return "ios";

  return "hidden";
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    mql.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getServerSnapshot(): PromptMode {
  return "hidden";
}

export default function InstallPrompt() {
  const mode = useSyncExternalStore(subscribe, computeMode, getServerSnapshot);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore quota / private-mode failures
    }
    emit();
  }

  async function install() {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    emit();
    await promptEvent.prompt();
    await promptEvent.userChoice;
  }

  return (
    <div
      role="dialog"
      aria-label="Install app"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-background/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 md:hidden"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-red/15 text-accent-red">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 pr-6">
          <p
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Install b!nje
          </p>
          {mode === "android" ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Add b!nje to your home screen for a faster, full-screen
              experience.
            </p>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-muted-foreground">
              Tap
              <Share className="inline h-3.5 w-3.5 text-foreground" />
              then
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <SquarePlus className="h-3.5 w-3.5" />
                Add to Home Screen
              </span>
              to install.
            </p>
          )}
        </div>
      </div>

      {mode === "android" && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            onClick={dismiss}
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
          >
            Not now
          </Button>
          <Button
            onClick={install}
            size="sm"
            className="h-8 gap-1.5 px-4 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </Button>
        </div>
      )}
    </div>
  );
}
