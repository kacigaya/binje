"use client";

import { GlassButton } from "@/components/liquid-glass";
import Image from "@/components/TmdbImage";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslations } from "@/lib/use-locale";

export const UP_NEXT_SECONDS = 10;

/** Shown when an episode ends: counts down, then plays the next one unless the viewer cancels. */
export default function UpNext({ label, still, onPlay, onCancel }: {
  /** Such as "S1:E2 · Cat's in the Bag". */
  label: string;
  still?: string | null;
  onPlay: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslations();
  const [left, setLeft] = useState(UP_NEXT_SECONDS);
  // The timer must not restart when the parent passes a new callback.
  const play = useEffectEvent(onPlay);

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left === 0) play();
  }, [left]);

  return (
    <section
      aria-label={t("Up next")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
      className="pointer-events-auto absolute right-2 bottom-16 z-30 flex w-[min(24rem,calc(100%-1rem))] gap-3 text-white text-shadow-md sm:right-3 sm:bottom-28"
    >
      {still && (
        <div className="relative hidden aspect-video w-32 shrink-0 self-start overflow-hidden rounded-lg bg-white/5 shadow-lg shadow-black/60 min-[420px]:block">
          <Image src={still} alt="" fill sizes="128px" className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold tracking-wide text-accent-red uppercase">{t("Up next")}</p>
        <p className="truncate text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
        <p role="status" className="text-xs text-white/85 tabular-nums">
          {t("Starts in")} {left}&nbsp;s
        </p>
        <div aria-hidden="true" className="h-0.5 overflow-hidden rounded-full bg-white/25 shadow-sm shadow-black/60">
          <div className="h-full origin-left bg-accent-red transition-transform duration-1000 ease-linear motion-reduce:transition-none" style={{ transform: `scaleX(${left / UP_NEXT_SECONDS})` }} />
        </div>
        <div className="flex gap-2 pt-1">
          <GlassButton material="tinted" size="sm" autoFocus onClick={onPlay} className="bg-white text-black text-shadow-none">
            {t("Play now")}
          </GlassButton>
          <GlassButton material="tinted" size="sm" onClick={onCancel} className="bg-black/60 text-white">
            {t("Cancel")}
          </GlassButton>
        </div>
      </div>
    </section>
  );
}
