"use client";

import { useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@appica/ui-react/alert";
import { Button } from "@appica/ui-react/button";
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
    <div className="animate-banner-enter fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto max-w-md sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-6">
      {/* A landmark rather than a dialog: focus is never moved into it and it
          does not trap, so announcing it as a dialog would misdescribe it.
          Alert's own dismissible close button is declined in favour of the
          explicit Refuse action, which has to record consent rather than just
          hide the banner. */}
      <Alert
        role="region"
        aria-label={t("Cookie consent")}
        className="bg-background/95 shadow-2xl backdrop-blur-xl"
      >
        <AlertIcon>
          <Cookie />
        </AlertIcon>
        <AlertTitle style={{ fontFamily: "var(--font-heading)" }}>
          {t("We use local storage")}
        </AlertTitle>
        <AlertDescription>
          {t("We store your watch history in your browser so you can pick up where you left off. No tracking, no third-party cookies.")}
        </AlertDescription>
        <AlertAction>
          <Button onClick={dismiss} size="sm" variant="ghost">
            {t("Refuse")}
          </Button>
          <Button onClick={accept} size="sm">
            {t("Accept")}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
