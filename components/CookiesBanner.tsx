"use client";

import { useSyncExternalStore } from "react";
import { Cookie, X } from "lucide-react";
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
    <div
      role="dialog"
      aria-label={t("Cookie consent")}
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-background/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-6 sm:left-auto sm:right-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("Dismiss")}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-red/15 text-accent-red">
          <Cookie className="h-5 w-5" />
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

      <div className="mt-3 flex items-center justify-end">
        <Button
          onClick={accept}
          size="sm"
          className="h-8 px-4 text-xs font-semibold"
        >
          {t("Accept")}
        </Button>
      </div>
    </div>
  );
}
