"use client";

import { Popover } from "@base-ui/react/popover";
import { Check } from "lucide-react";
import { Languages } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useId, type RefObject } from "react";
import { controlButtonClass } from "@/components/PlayerControls";
import { useTranslations } from "@/lib/use-locale";

export default function AudioMenu({
  container, value, onSelect, pending, frenchUnavailable, disabled,
}: {
  container: RefObject<HTMLElement | null>;
  value: "vo" | "vf";
  onSelect: (value: "vo" | "vf") => void;
  pending: boolean;
  frenchUnavailable: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslations();
  const name = useId();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("Audio")}
        title={t("Audio")}
        aria-busy={pending}
        disabled={disabled}
        className={controlButtonClass}
      >
        <MorphIcon icon={Languages} aria-hidden="true" reducedMotion="user" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner positionMethod="fixed" sideOffset={8} collisionPadding={8} className="z-50 outline-none">
          <Popover.Popup className="max-h-[var(--available-height)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-white/10 bg-popover text-sm text-foreground shadow-lg shadow-black/40 outline-none">
            <Popover.Title className="sr-only">{t("Audio")}</Popover.Title>
            <fieldset className="min-w-0 p-1" disabled={disabled}>
              <legend className="sr-only">{t("Audio")}</legend>
              {(["vo", "vf"] as const).map((version) => (
                <label
                  key={version}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/10 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-accent-red/60"
                >
                  <input
                    type="radio"
                    name={name}
                    checked={value === version}
                    disabled={version === "vf" && frenchUnavailable}
                    onClick={() => {
                      // A failed French source can show VO while the saved choice is still VF.
                      if (value === version) onSelect(version);
                    }}
                    onChange={() => onSelect(version)}
                    className="sr-only"
                  />
                  {/* eslint-disable shadcn/no-raw-colors -- National flag colors stay fixed across themes. */}
                  <svg
                    aria-hidden="true"
                    data-audio-flag={version === "vo" ? "en" : "fr"}
                    viewBox={version === "vo" ? "0 0 60 30" : "0 0 60 40"}
                    className="h-3.5 w-5 shrink-0 overflow-hidden"
                  >
                    {version === "vo" ? (
                      <>
                        <path fill="#012169" d="M0 0h60v30H0z" />
                        <path stroke="#fff" strokeWidth="6" d="m0 0 60 30m0-30L0 30" />
                        <path fill="#c8102e" d="m0 0 30 15h-6L0 3zm60 0L30 15V12L54 0zM0 30l30-15v3L6 30zm60 0L30 15h6l24 12z" />
                        <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
                        <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
                      </>
                    ) : (
                      <>
                        <path fill="#002654" d="M0 0h20v40H0z" />
                        <path fill="#fff" d="M20 0h20v40H20z" />
                        <path fill="#ed2939" d="M40 0h20v40H40z" />
                      </>
                    )}
                  </svg>
                  {/* eslint-enable shadcn/no-raw-colors */}
                  <span className="flex-1">{version === "vo" ? t("Original audio") : t("French audio")}</span>
                  {value === version && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                </label>
              ))}
            </fieldset>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
