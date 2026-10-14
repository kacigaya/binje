"use client";

import { Popover } from "@base-ui/react/popover";
import { Captions, CaptionsOff, Check, LoaderCircle, Minus, Plus, RotateCcw, Wand2 } from "lucide-react";
import type { RefObject } from "react";
import { useId } from "react";
import { controlButtonClass } from "@/components/PlayerControls";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

export const DELAY_STEP = 0.5;

export type SyncStatus = "idle" | "syncing" | "synced" | "failed" | "busy" | "unmatched" | "unsupported" | "unavailable" | "invalid-subtitles";

export function formatDelay(seconds: number) {
  const rounded = Math.round(seconds * 100) / 100;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
}

const smallButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-red/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5";

/** Render inside the player so the menu remains visible in container fullscreen. */
export default function SubtitleMenu({
  container,
  labels,
  active,
  onSelect,
  delay,
  onDelayChange,
  onReset,
  syncStatus,
  onAutoSync,
}: {
  container: RefObject<HTMLElement | null>;
  labels: string[];
  active: number;
  onSelect: (index: number) => void;
  delay: number;
  onDelayChange: (delay: number) => void;
  onReset: () => void;
  syncStatus: SyncStatus;
  onAutoSync: () => void;
}) {
  const { t } = useTranslations();
  const name = useId();
  const on = active >= 0;
  const statusText = {
    idle: "",
    syncing: t("Listening to the audio… This can take a minute."),
    synced: t("Synced to the audio."),
    failed: t("Couldn’t read the stream’s audio. Try again or adjust the delay."),
    unmatched: t("These subtitles don’t match the audio closely enough. Try another file or adjust the delay."),
    unsupported: t("Auto-sync isn’t available for this stream. Adjust the delay manually."),
    unavailable: t("Auto-sync is unavailable on the server. Adjust the delay manually."),
    "invalid-subtitles": t("This subtitle file has too few usable lines. Try another file."),
    busy: t("Sync is busy. Try again shortly."),
  }[syncStatus];

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={t("Subtitles")} title={t("Subtitles")} className={controlButtonClass}>
        {on ? <Captions aria-hidden="true" /> : <CaptionsOff aria-hidden="true" className="text-white/60" />}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner positionMethod="fixed" sideOffset={8} collisionPadding={8} className="z-50 outline-none">
          <Popover.Popup className="flex max-h-[min(28rem,70dvh,var(--available-height))] w-72 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-popover text-sm text-foreground shadow-lg shadow-black/40 outline-none">
            <Popover.Title className="sr-only">{t("Subtitles")}</Popover.Title>
            {on && (
              <div className="flex shrink-0 flex-col gap-1 border-b border-white/10 p-2">
                <div className="flex items-center justify-between gap-2 pl-2">
                  <span id={`${name}-delay`} className="text-xs text-muted-foreground">{t("Subtitle delay")}</span>
                  <div role="group" aria-labelledby={`${name}-delay`} className="flex items-center">
                    <button
                      type="button"
                      aria-label={t("Subtitles earlier")}
                      title={`${t("Subtitles earlier")} (G)`}
                      onClick={() => onDelayChange(delay - DELAY_STEP)}
                      className={cn(smallButtonClass, "w-9 px-0")}
                    >
                      <Minus aria-hidden="true" />
                    </button>
                    <output aria-live="polite" className="w-16 text-center text-xs font-semibold tabular-nums">
                      {formatDelay(delay)}
                    </output>
                    <button
                      type="button"
                      aria-label={t("Subtitles later")}
                      title={`${t("Subtitles later")} (H)`}
                      onClick={() => onDelayChange(delay + DELAY_STEP)}
                      className={cn(smallButtonClass, "w-9 px-0")}
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onAutoSync}
                    disabled={syncStatus === "syncing"}
                    className={cn(smallButtonClass, "flex-1 bg-white/10")}
                  >
                    {syncStatus === "syncing"
                      ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                      : <Wand2 aria-hidden="true" />}
                    {t("Auto-sync")}
                  </button>
                  <button type="button" onClick={onReset} className={smallButtonClass}>
                    <RotateCcw aria-hidden="true" />
                    {t("Reset")}
                  </button>
                </div>
                <p role="status" className={cn("px-2 text-xs text-muted-foreground", !statusText && "sr-only")}>
                  {statusText}
                </p>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <fieldset className="min-w-0 p-1">
                <legend className="sr-only">{t("Subtitles")}</legend>
                {[t("Off"), ...labels].map((label, i) => {
                  const index = i - 1;
                  return (
                    <label
                      key={index}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/10 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-accent-red/60"
                    >
                      <input
                        type="radio"
                        name={name}
                        checked={index === active}
                        onChange={() => onSelect(index)}
                        className="sr-only"
                      />
                      <span className="truncate">{label}</span>
                      {index === active && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                    </label>
                  );
                })}
              </fieldset>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
