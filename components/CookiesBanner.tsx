"use client";

import { useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { Button } from "@/components/ui/button";
import { setConsent, CONSENT_STORAGE_KEY } from "@/lib/consent";
import { useTranslations } from "@/lib/use-locale";

function subscribeToConsent(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getConsentSnapshot(): string | null {
  return window.localStorage.getItem(CONSENT_STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export default function CookiesBanner() {
  const { t } = useTranslations();
  const [dismissIcon, dismissFeedback] = useAnimatedIcon();
  const storedConsent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerSnapshot,
  );

  if (storedConsent !== null) return null;

  function accept() {
    setConsent("accepted");
    notifyChange();
  }

  function dismiss() {
    setConsent("dismissed");
    notifyChange();
  }

  function notifyChange() {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CONSENT_STORAGE_KEY,
        newValue: window.localStorage.getItem(CONSENT_STORAGE_KEY),
      }),
    );
  }

  return (
    // The enter animation and the backdrop blur are deliberately on separate
    // elements: an element that both animates and carries a backdrop-filter
    // cannot be composited, so the transform would run on the main thread.
    // The keyframe itself lives in globals.css for the same reason.
    // A landmark rather than a dialog: focus is never moved into it and it
    // does not trap, so announcing it as a dialog would misdescribe it.
    <div
      role="region"
      aria-label={t("Cookie consent")}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto max-w-md sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-6 animate-banner-enter"
    >
      <div className="relative rounded-2xl border border-white/10 bg-background/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <button
          type="button"
          onClick={dismiss}
          {...dismissFeedback}
          aria-label={t("Dismiss")}
          className="absolute right-2 top-2 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          <XIcon ref={dismissIcon} size={16} />
        </button>

        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-red/15 text-accent-red">
            <Cookie className="size-5" />
          </span>
          <div className="min-w-0 pr-6">
            <p
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("We use local storage")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("We store your watch history in your browser so you can pick up where you left off. No tracking, no third-party cookies.")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            onClick={dismiss}
            size="sm"
            variant="secondary"
            className="h-8 px-4 text-xs font-semibold"
          >
            {t("Refuse")}
          </Button>
          <Button
            onClick={accept}
            size="sm"
            className="h-8 px-4 text-xs font-semibold"
          >
            {t("Accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
