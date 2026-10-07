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
    // The enter keyframe lives in globals.css and stays on the compositor
    // (transform/opacity only). The panel is near-opaque, so it carries no
    // backdrop-filter: blurring behind bg-background/95 costs GPU for no
    // visible effect.
    // A landmark rather than a dialog: focus is never moved into it and it
    // does not trap, so announcing it as a dialog would misdescribe it.
    // A slim bar rather than a card: the card covered the first row of
    // posters and, on phones, the detail page's play button.
    <div
      role="region"
      aria-label={t("Cookie consent")}
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl animate-banner-enter sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-background/95 p-3 shadow-2xl shadow-black/40 sm:flex-row sm:items-center sm:gap-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
          <Cookie aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-red sm:mt-0" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("We use local storage")}.
            </span>{" "}
            {t("We store your watch history in your browser so you can pick up where you left off. No tracking, no third-party cookies.")}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
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
          <button
            type="button"
            onClick={dismiss}
            {...dismissFeedback}
            aria-label={t("Dismiss")}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            <XIcon ref={dismissIcon} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
