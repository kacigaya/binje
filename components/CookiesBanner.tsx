"use client";

import { useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import {
  GlassActionButton,
  GlassButton,
  GlassCard,
} from "@/components/liquid-glass";
import { getConsent, setConsent, CONSENT_STORAGE_KEY } from "@/lib/consent";
import { useTranslations } from "@/lib/use-locale";

function subscribeToConsent(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

// Unknown during SSR and hydration; only show the banner after checking storage.
function getServerSnapshot(): undefined {
  return undefined;
}

const ACCEPTED_HOLD_MS = 1200;

export default function CookiesBanner() {
  const { t } = useTranslations();
  const [dismissIcon, dismissFeedback] = useAnimatedIcon();
  const storedConsent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerSnapshot,
  );

  if (storedConsent !== null) return null;

  // Let the success state land before the banner leaves.
  function accept() {
    setConsent("accepted");
    window.setTimeout(() => notifyChange("accepted"), ACCEPTED_HOLD_MS);
  }

  function dismiss() {
    setConsent("dismissed");
    notifyChange("dismissed");
  }

  function notifyChange(value: "accepted" | "dismissed") {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CONSENT_STORAGE_KEY,
        newValue: value,
      }),
    );
  }

  return (
    // Use a landmark because the banner does not take focus.
    <div
      role="region"
      aria-label={t("Cookie consent")}
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl animate-banner-enter sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <GlassCard tint={0.55} className="relative flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
          <Cookie aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("We use local storage")}.
            </span>{" "}
            {t("We store your watch history in your browser so you can pick up where you left off. No tracking, no third-party cookies.")}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <GlassButton onClick={dismiss} size="sm" tint={0.15}>
            {t("Refuse")}
          </GlassButton>
          <GlassActionButton
            onAction={accept}
            size="sm"
            material="tinted"
            className="bg-accent-red text-white"
            successLabel={t("Accepted")}
          >
            {t("Accept")}
          </GlassActionButton>
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
      </GlassCard>
    </div>
  );
}
